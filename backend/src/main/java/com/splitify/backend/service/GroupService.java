package com.splitify.backend.service;

import com.splitify.backend.dto.group.CreateGroupRequest;
import com.splitify.backend.dto.group.DebtDto;
import com.splitify.backend.dto.group.GroupDto;
import com.splitify.backend.dto.group.GroupSettlementDto;
import com.splitify.backend.dto.user.UserDto;
import com.splitify.backend.entity.*;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.GroupRepository;
import com.splitify.backend.repository.ReceiptRepository;
import com.splitify.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final ReceiptRepository receiptRepository;
    private final NotificationService notificationService;

    @Transactional
    public GroupDto createGroup(UUID currentUserId, CreateGroupRequest request) {
        User creator = findUser(currentUserId);

        Group group = Group.builder()
            .name(request.getName())
            .description(request.getDescription())
            .createdBy(creator)
            .build();
        group.getMembers().add(creator);
        groupRepository.save(group);

        return toDto(group);
    }

    public List<GroupDto> getMyGroups(UUID currentUserId) {
        return groupRepository.findGroupsByMemberId(currentUserId)
            .stream().map(this::toDto).toList();
    }

    public GroupDto getGroup(UUID groupId, UUID currentUserId) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);
        return toDto(group);
    }

    @Transactional
    public GroupDto addMember(UUID groupId, UUID currentUserId, String email) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);

        User newMember = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        if (group.getMembers().stream().anyMatch(u -> u.getId().equals(newMember.getId()))) {
            throw new BadRequestException("User is already a member of this group");
        }

        group.getMembers().add(newMember);
        groupRepository.save(group);

        User adder = findUser(currentUserId);
        notificationService.sendNotification(
            newMember,
            NotificationType.GROUP_ADDED,
            "Added to group",
            adder.getName() + " added you to \"" + group.getName() + "\"",
            groupId.toString()
        );

        return toDto(group);
    }

    @Transactional
    public void removeMember(UUID groupId, UUID currentUserId, UUID targetUserId) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);

        boolean removed = group.getMembers().removeIf(u -> u.getId().equals(targetUserId));
        if (!removed) {
            throw new ResourceNotFoundException("User is not a member of this group");
        }
        groupRepository.save(group);
    }

    @Transactional
    public void deleteGroup(UUID groupId, UUID currentUserId) {
        Group group = findGroup(groupId);
        if (!group.getCreatedBy().getId().equals(currentUserId)) {
            throw new BadRequestException("Only the group creator can delete the group");
        }
        groupRepository.delete(group);
    }

    public GroupSettlementDto getGroupSettlement(UUID groupId, UUID currentUserId) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);

        List<Receipt> pendingReceipts = receiptRepository.findByGroupIdOrderByCreatedAtDesc(groupId)
            .stream()
            .filter(r -> r.getStatus() == ReceiptStatus.PENDING_PAYMENT)
            .toList();

        // net balance per user: positive = is owed money, negative = owes money
        Map<UUID, BigDecimal> balance = new HashMap<>();
        Map<UUID, String> names = new HashMap<>();
        Map<UUID, String> revolutTags = new HashMap<>();
        String currency = group.getMembers().isEmpty() ? "RON" : "RON";

        for (Receipt receipt : pendingReceipts) {
            UUID scannerId = receipt.getCreatedBy().getId();
            names.put(scannerId, receipt.getCreatedBy().getName());
            revolutTags.put(scannerId, receipt.getCreatedBy().getRevolutTag());
            if (receipt.getCurrency() != null) currency = receipt.getCurrency();

            Set<UUID> paidUserIds = receipt.getPayments().stream()
                .map(p -> p.getPayer().getId())
                .collect(Collectors.toSet());

            // sum amountOwed per non-scanner participant for this receipt
            Map<UUID, BigDecimal> receiptOwed = new HashMap<>();
            for (ReceiptItem item : receipt.getItems()) {
                for (ItemAssignment assignment : item.getAssignments()) {
                    UUID uid = assignment.getUser().getId();
                    if (!uid.equals(scannerId)) {
                        names.put(uid, assignment.getUser().getName());
                        revolutTags.put(uid, assignment.getUser().getRevolutTag());
                        BigDecimal amt = assignment.getAmountOwed() != null ? assignment.getAmountOwed() : BigDecimal.ZERO;
                        receiptOwed.merge(uid, amt, BigDecimal::add);
                    }
                }
            }

            for (Map.Entry<UUID, BigDecimal> entry : receiptOwed.entrySet()) {
                UUID debtorId = entry.getKey();
                if (!paidUserIds.contains(debtorId)) {
                    balance.merge(debtorId, entry.getValue().negate(), BigDecimal::add);
                    balance.merge(scannerId, entry.getValue(), BigDecimal::add);
                }
            }
        }

        // Greedy debt simplification
        List<UUID> creditorIds = new ArrayList<>();
        List<BigDecimal> creditorAmts = new ArrayList<>();
        List<UUID> debtorIds = new ArrayList<>();
        List<BigDecimal> debtorAmts = new ArrayList<>();

        for (Map.Entry<UUID, BigDecimal> e : balance.entrySet()) {
            int cmp = e.getValue().compareTo(BigDecimal.ZERO);
            if (cmp > 0) { creditorIds.add(e.getKey()); creditorAmts.add(e.getValue()); }
            else if (cmp < 0) { debtorIds.add(e.getKey()); debtorAmts.add(e.getValue().negate()); }
        }

        List<DebtDto> debts = new ArrayList<>();
        int i = 0, j = 0;
        while (i < creditorIds.size() && j < debtorIds.size()) {
            BigDecimal settle = creditorAmts.get(i).min(debtorAmts.get(j));
            if (settle.compareTo(new BigDecimal("0.01")) >= 0) {
                debts.add(new DebtDto(
                    debtorIds.get(j), names.get(debtorIds.get(j)),
                    creditorIds.get(i), names.get(creditorIds.get(i)),
                    revolutTags.get(creditorIds.get(i)),
                    settle.setScale(2, RoundingMode.HALF_UP),
                    currency
                ));
            }
            creditorAmts.set(i, creditorAmts.get(i).subtract(settle));
            debtorAmts.set(j, debtorAmts.get(j).subtract(settle));
            if (creditorAmts.get(i).compareTo(BigDecimal.ZERO) == 0) i++;
            if (debtorAmts.get(j).compareTo(BigDecimal.ZERO) == 0) j++;
        }

        return new GroupSettlementDto(debts);
    }

    private Group findGroup(UUID id) {
        return groupRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
    }

    private User findUser(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void assertMember(Group group, UUID userId) {
        if (group.getMembers().stream().noneMatch(u -> u.getId().equals(userId))) {
            throw new BadRequestException("You are not a member of this group");
        }
    }

    private GroupDto toDto(Group group) {
        List<UserDto> memberDtos = group.getMembers().stream()
            .map(UserService::toDto)
            .toList();

        return new GroupDto(
            group.getId(),
            group.getName(),
            group.getDescription(),
            group.getCreatedBy().getId(),
            group.getCreatedBy().getName(),
            group.getCreatedAt(),
            memberDtos
        );
    }
}
