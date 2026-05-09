package com.splitify.backend.service;

import com.splitify.backend.dto.receipt.*;
import com.splitify.backend.entity.*;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReceiptService {

    private final ReceiptRepository receiptRepository;
    private final ReceiptItemRepository receiptItemRepository;
    private final ItemAssignmentRepository itemAssignmentRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final OcrService ocrService;
    private final SplitCalculationService splitCalculationService;

    @Transactional
    public ReceiptDto scanReceipt(UUID currentUserId, MultipartFile image, String title, UUID groupId) {
        User user = findUser(currentUserId);

        String base64Image = encodeToBase64(image);
        String mimeType = resolveMimeType(image);

        Receipt receipt = Receipt.builder()
            .title(title)
            .scannedBy(user)
            .imageBase64(base64Image)
            .imageMimeType(mimeType)
            .status(ReceiptStatus.PROCESSING)
            .currency("RON")
            .totalAmount(BigDecimal.ZERO)
            .build();

        if (groupId != null) {
            Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
            receipt.setGroup(group);
        }

        receiptRepository.save(receipt);

        try {
            OcrService.OcrResult ocrResult = ocrService.extractFromImage(base64Image, mimeType);
            populateFromOcr(receipt, ocrResult);
            receipt.setStatus(ReceiptStatus.PROCESSED);
        } catch (Exception e) {
            log.error("OCR failed for receipt {}", receipt.getId(), e);
            receipt.setStatus(ReceiptStatus.FAILED);
        }

        receiptRepository.save(receipt);
        return toDto(receipt);
    }

    public List<ReceiptDto> getMyReceipts(UUID currentUserId) {
        return receiptRepository.findByScannedByIdOrderByScannedAtDesc(currentUserId)
            .stream().map(this::toDto).toList();
    }

    public List<ReceiptDto> getGroupReceipts(UUID groupId, UUID currentUserId) {
        return receiptRepository.findByGroupIdOrderByScannedAtDesc(groupId)
            .stream().map(this::toDto).toList();
    }

    public ReceiptDto getReceipt(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);
        return toDto(receipt);
    }

    @Transactional
    public ReceiptDto updateReceipt(UUID receiptId, UUID currentUserId, UpdateReceiptRequest request) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        if (request.getTitle() != null) receipt.setTitle(request.getTitle());
        if (request.getCurrency() != null) receipt.setCurrency(request.getCurrency());
        if (request.getGroupId() != null) {
            Group group = groupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
            receipt.setGroup(group);
        }

        return toDto(receiptRepository.save(receipt));
    }

    @Transactional
    public ReceiptItemDto updateReceiptItem(UUID receiptId, UUID itemId, UUID currentUserId,
                                            UpdateReceiptItemRequest request) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        ReceiptItem item = findItem(itemId);
        item.setName(request.getName());
        item.setQuantity(request.getQuantity());
        item.setUnitPrice(request.getUnitPrice());
        item.setTotalPrice(request.getTotalPrice());

        recalculateReceiptTotal(receipt);
        receiptRepository.save(receipt);

        return toItemDto(receiptItemRepository.save(item));
    }

    @Transactional
    public ReceiptItemDto assignItem(UUID receiptId, UUID itemId, UUID currentUserId,
                                     AssignItemRequest request) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        ReceiptItem item = findItem(itemId);

        if (request.getAssignees() == null || request.getAssignees().isEmpty()) {
            itemAssignmentRepository.deleteByItemId(itemId);
            item.getAssignments().clear();
            return toItemDto(item);
        }

        List<UUID> userIds = request.getAssignees().stream()
            .map(AssignItemRequest.AssigneeEntry::getUserId).toList();
        List<User> users = userRepository.findAllById(userIds);

        if (users.size() != userIds.size()) {
            throw new BadRequestException("One or more users not found");
        }

        itemAssignmentRepository.deleteByItemId(itemId);
        item.getAssignments().clear();

        List<ItemAssignment> assignments =
            splitCalculationService.buildAssignments(item, request.getAssignees(), users);

        itemAssignmentRepository.saveAll(assignments);
        item.setAssignments(assignments);

        return toItemDto(item);
    }

    public ReceiptSummaryDto getSummary(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        Map<UUID, ParticipantSummaryDto> participantMap = new LinkedHashMap<>();
        BigDecimal assignedTotal = BigDecimal.ZERO;

        for (ReceiptItem item : receipt.getItems()) {
            for (ItemAssignment assignment : item.getAssignments()) {
                UUID uid = assignment.getUser().getId();
                participantMap.computeIfAbsent(uid, id -> new ParticipantSummaryDto(
                    assignment.getUser().getId(),
                    assignment.getUser().getName(),
                    assignment.getUser().getEmail(),
                    BigDecimal.ZERO,
                    new ArrayList<>()
                ));

                ParticipantSummaryDto participant = participantMap.get(uid);
                BigDecimal amount = assignment.getAmountOwed() != null ? assignment.getAmountOwed() : BigDecimal.ZERO;
                participant.setTotalOwed(participant.getTotalOwed().add(amount));
                participant.getItemBreakdown().add(new ParticipantSummaryDto.ItemContributionDto(
                    item.getId(), item.getName(), amount
                ));

                assignedTotal = assignedTotal.add(amount);
            }
        }

        BigDecimal total = receipt.getTotalAmount() != null ? receipt.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal unassigned = total.subtract(assignedTotal).max(BigDecimal.ZERO);

        return new ReceiptSummaryDto(
            receipt.getId(),
            receipt.getTitle(),
            total,
            receipt.getCurrency(),
            assignedTotal.setScale(2, RoundingMode.HALF_UP),
            unassigned.setScale(2, RoundingMode.HALF_UP),
            new ArrayList<>(participantMap.values())
        );
    }

    @Transactional
    public void deleteReceipt(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);
        receiptRepository.delete(receipt);
    }

    // ---- helpers ----

    private void populateFromOcr(Receipt receipt, OcrService.OcrResult result) {
        receipt.setCurrency(result.getCurrency());
        receipt.setTotalAmount(result.getTotal());

        if (result.getItems() != null) {
            List<ReceiptItem> items = new ArrayList<>();
            for (int i = 0; i < result.getItems().size(); i++) {
                OcrService.OcrItem ocrItem = result.getItems().get(i);
                ReceiptItem item = ReceiptItem.builder()
                    .receipt(receipt)
                    .name(ocrItem.getName() != null ? ocrItem.getName() : "Unknown item")
                    .quantity(ocrItem.getQuantity() != null ? ocrItem.getQuantity() : BigDecimal.ONE)
                    .unitPrice(ocrItem.getUnitPrice())
                    .totalPrice(ocrItem.getTotalPrice())
                    .position(i)
                    .build();
                items.add(item);
            }
            receiptItemRepository.saveAll(items);
            receipt.setItems(items);
        }
    }

    private void recalculateReceiptTotal(Receipt receipt) {
        BigDecimal total = receipt.getItems().stream()
            .map(i -> i.getTotalPrice() != null ? i.getTotalPrice() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        receipt.setTotalAmount(total);
    }

    private String encodeToBase64(MultipartFile file) {
        try {
            return Base64.getEncoder().encodeToString(file.getBytes());
        } catch (Exception e) {
            throw new BadRequestException("Failed to read uploaded image");
        }
    }

    private String resolveMimeType(MultipartFile file) {
        String ct = file.getContentType();
        if (ct != null && ct.startsWith("image/")) return ct;
        return "image/jpeg";
    }

    private Receipt findReceipt(UUID id) {
        return receiptRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Receipt not found"));
    }

    private ReceiptItem findItem(UUID id) {
        return receiptItemRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Receipt item not found"));
    }

    private User findUser(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void assertAccess(Receipt receipt, UUID userId) {
        if (!receipt.getScannedBy().getId().equals(userId)) {
            throw new BadRequestException("You do not have access to this receipt");
        }
    }

    // ---- DTO mapping ----

    private ReceiptDto toDto(Receipt receipt) {
        List<ReceiptItemDto> itemDtos = receipt.getItems().stream()
            .map(this::toItemDto).toList();

        return new ReceiptDto(
            receipt.getId(),
            receipt.getTitle(),
            receipt.getScannedBy().getId(),
            receipt.getScannedBy().getName(),
            receipt.getGroup() != null ? receipt.getGroup().getId() : null,
            receipt.getGroup() != null ? receipt.getGroup().getName() : null,
            receipt.getTotalAmount(),
            receipt.getCurrency(),
            receipt.getStatus(),
            receipt.getScannedAt(),
            itemDtos
        );
    }

    private ReceiptItemDto toItemDto(ReceiptItem item) {
        List<AssignmentDto> assignments = item.getAssignments().stream()
            .map(a -> new AssignmentDto(
                a.getId(),
                a.getUser().getId(),
                a.getUser().getName(),
                a.getSplitType(),
                a.getSplitValue(),
                a.getAmountOwed()
            ))
            .toList();

        return new ReceiptItemDto(
            item.getId(),
            item.getName(),
            item.getQuantity(),
            item.getUnitPrice(),
            item.getTotalPrice(),
            item.getPosition(),
            assignments
        );
    }
}
