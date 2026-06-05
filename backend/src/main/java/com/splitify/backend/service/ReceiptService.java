package com.splitify.backend.service;

import com.splitify.backend.dto.receipt.*;
import com.splitify.backend.entity.*;
import com.splitify.backend.entity.ReceiptStatus;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReceiptService {

    private final ReceiptRepository receiptRepository;
    private final ReceiptItemRepository receiptItemRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final OcrService ocrService;
    private final SplitCalculationService splitCalculationService;
    private final NotificationService notificationService;

    @Transactional
    public ReceiptDto scanReceipt(UUID currentUserId, MultipartFile image, String title, UUID groupId) {
        User user = findUser(currentUserId);

        String base64Image = encodeToBase64(image);
        String mimeType = resolveMimeType(image);

        OcrService.OcrResult ocrResult;
        try {
            ocrResult = ocrService.extractFromImage(base64Image, mimeType);
        } catch (Exception e) {
            log.error("OCR failed", e);
            throw new BadRequestException("Receipt scanning is temporarily unavailable. Please try again later.");
        }

        Receipt receipt = Receipt.builder()
            .title(title)
            .createdBy(user)
            .imageBase64(base64Image)
            .imageMimeType(mimeType)
            .currency("RON")
            .totalAmount(BigDecimal.ZERO)
            .build();

        if (groupId != null) {
            Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
            receipt.setGroup(group);
        }

        populateFromOcr(receipt, ocrResult);
        receiptRepository.save(receipt);

        return toDto(receipt);
    }

    public List<ReceiptDto> getMyReceipts(UUID currentUserId) {
        return receiptRepository.findByCreatedByIdOrderByCreatedAtDesc(currentUserId)
            .stream().map(this::toDto).toList();
    }

    public List<ReceiptDto> getGroupReceipts(UUID groupId, UUID currentUserId, boolean unpaidOnly) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
        if (group.getMembers().stream().noneMatch(u -> u.getId().equals(currentUserId))) {
            throw new BadRequestException("You are not a member of this group");
        }
        return receiptRepository.findByGroupIdOrderByCreatedAtDesc(groupId)
            .stream()
            .filter(r -> !unpaidOnly || ((r.getStatus() == ReceiptStatus.PENDING_PAYMENT || r.getStatus() == ReceiptStatus.FINALIZED) &&
                r.getPayments().stream().noneMatch(p -> p.getPayer().getId().equals(currentUserId))))
            .map(this::toDto)
            .toList();
    }

    public ReceiptDto getReceipt(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);
        return toDto(receipt);
    }

    @Transactional
    public ReceiptItemDto addReceiptItem(UUID receiptId, UUID currentUserId, ReceiptItemRequest request) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        BigDecimal qty = request.getQuantity() != null ? request.getQuantity() : BigDecimal.ONE;
        BigDecimal price = request.getUnitPrice() != null ? request.getUnitPrice() : BigDecimal.ZERO;
        BigDecimal total = qty.multiply(price).setScale(2, java.math.RoundingMode.HALF_UP);

        ReceiptItem item = ReceiptItem.builder()
            .receipt(receipt)
            .name(request.getName())
            .quantity(qty)
            .unitPrice(price)
            .totalPrice(total)
            .build();

        receipt.getItems().add(item);
        recalculateReceiptTotal(receipt);
        receiptRepository.save(receipt);

        return toItemDto(item);
    }

    @Transactional
    public void deleteReceiptItem(UUID receiptId, UUID itemId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        boolean removed = receipt.getItems().removeIf(i -> i.getId().equals(itemId));
        if (!removed) {
            throw new ResourceNotFoundException("Receipt item not found");
        }
        recalculateReceiptTotal(receipt);
        receiptRepository.save(receipt);
    }

    @Transactional
    public ReceiptItemDto updateReceiptItem(UUID receiptId, UUID itemId, UUID currentUserId,
                                            ReceiptItemRequest request) {
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

        item.getAssignments().clear();
        receiptItemRepository.saveAndFlush(item);

        if (request.getAssignees() == null || request.getAssignees().isEmpty()) {
            return toItemDto(item);
        }

        List<UUID> userIds = request.getAssignees().stream()
            .map(AssignItemRequest.AssigneeEntry::getUserId).toList();
        List<User> users = userRepository.findAllById(userIds);

        if (users.size() != userIds.size()) {
            throw new BadRequestException("One or more users not found");
        }

        List<ItemAssignment> assignments =
            splitCalculationService.buildAssignments(item, request.getAssignees(), users);

        item.getAssignments().addAll(assignments);
        receiptItemRepository.saveAndFlush(item);

        return toItemDto(item);
    }

    public ReceiptSummaryDto getSummary(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);

        Map<UUID, ParticipantSummaryDto> participantMap = new LinkedHashMap<>();

        for (ReceiptItem item : receipt.getItems()) {
            for (ItemAssignment assignment : item.getAssignments()) {
                UUID uid = assignment.getUser().getId();
                participantMap.computeIfAbsent(uid, id -> new ParticipantSummaryDto(
                    assignment.getUser().getId(),
                    assignment.getUser().getName(),
                    assignment.getUser().getEmail(),
                    BigDecimal.ZERO,
                    new ArrayList<>(),
                    false,
                    null
                ));

                ParticipantSummaryDto participant = participantMap.get(uid);
                BigDecimal amount = assignment.getAmountOwed() != null ? assignment.getAmountOwed() : BigDecimal.ZERO;
                participant.setTotalOwed(participant.getTotalOwed().add(amount));
                participant.getItemBreakdown().add(new ParticipantSummaryDto.ItemContributionDto(
                    item.getId(), item.getName(), amount
                ));
            }
        }

        Map<UUID, LocalDateTime> paymentTimes = receipt.getPayments()
            .stream().collect(Collectors.toMap(p -> p.getPayer().getId(), BaseEntity::getCreatedAt));
        participantMap.values().forEach(p -> {
            LocalDateTime paidAt = paymentTimes.get(p.getUserId());
            p.setPaid(paidAt != null);
            p.setPaidAt(paidAt);
        });

        UUID scannerId = receipt.getCreatedBy().getId();
        List<ParticipantSummaryDto> participants = participantMap.values().stream()
            .sorted(Comparator.comparing(p -> !p.getUserId().equals(scannerId)))
            .collect(Collectors.toList());

        BigDecimal total = receipt.getTotalAmount() != null ? receipt.getTotalAmount() : BigDecimal.ZERO;

        return new ReceiptSummaryDto(
            receipt.getId(),
            receipt.getTitle(),
            total,
            receipt.getCurrency(),
            participants
        );
    }

    @Transactional
    public void markPaid(UUID receiptId, UUID currentUserId, UUID payerId) {
        Receipt receipt = findReceipt(receiptId);
        assertIsScanner(receipt, currentUserId);
        if (receipt.getPayments().stream().noneMatch(p -> p.getPayer().getId().equals(payerId))) {
            User payer = findUser(payerId);
            receipt.getPayments().add(Payment.builder().receipt(receipt).payer(payer).build());
        }
        if (allParticipantsPaid(receipt)) {
            receipt.setStatus(ReceiptStatus.FINALIZED);
        }
        receiptRepository.save(receipt);
    }

    @Transactional
    public ReceiptDto finalizeReceipt(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertIsScanner(receipt, currentUserId);
        boolean allAssigned = receipt.getItems().stream()
            .allMatch(item -> item.getAssignments() != null && !item.getAssignments().isEmpty());
        if (!allAssigned) {
            throw new BadRequestException("All items must be assigned before finalizing");
        }
        receipt.setStatus(ReceiptStatus.PENDING_PAYMENT);
        Receipt saved = receiptRepository.save(receipt);

        // Scanner paid upfront, so auto-mark them as paid
        if (saved.getPayments().stream().noneMatch(p -> p.getPayer().getId().equals(currentUserId))) {
            saved.getPayments().add(Payment.builder().receipt(saved).payer(saved.getCreatedBy()).build());
        }

        // If the scanner is the only participant, settle immediately
        if (allParticipantsPaid(saved)) {
            saved.setStatus(ReceiptStatus.FINALIZED);
            receiptRepository.save(saved);
        }

        // Notify each participant (except scanner) that payment is requested
        saved.getItems().stream()
            .flatMap(item -> item.getAssignments().stream())
            .map(ItemAssignment::getUser)
            .filter(u -> !u.getId().equals(currentUserId))
            .distinct()
            .forEach(participant -> notificationService.sendNotification(
                participant,
                NotificationType.PAYMENT_REQUESTED,
                "Payment requested",
                saved.getCreatedBy().getName() + " requests payment for \"" + saved.getTitle() + "\"",
                saved.getId().toString()
            ));

        return toDto(saved);
    }

    @Transactional
    public ReceiptDto updateReceipt(UUID receiptId, UUID currentUserId, UpdateReceiptRequest request) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);
        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            receipt.setTitle(request.getTitle().trim());
        }
        if (request.getCurrency() != null && !request.getCurrency().isBlank()) {
            receipt.setCurrency(request.getCurrency().toUpperCase());
        }
        if (request.getCategory() != null) {
            receipt.setCategory(request.getCategory());
        }
        return toDto(receiptRepository.save(receipt));
    }

    @Transactional
    public void deleteReceipt(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);
        receiptRepository.delete(receipt);
    }

    // ---- helpers ----

    @Transactional
    public ReceiptDto createManualReceipt(UUID currentUserId, String title, UUID groupId, String category, String currency) {
        User user = findUser(currentUserId);

        ReceiptCategory receiptCategory = ReceiptCategory.OTHER;
        if (category != null) {
            try {
                receiptCategory = ReceiptCategory.valueOf(category.toUpperCase());
            } catch (IllegalArgumentException ignored) {}
        }

        String resolvedCurrency = currency != null ? currency.toUpperCase()
                : (user.getPreferredCurrency() != null ? user.getPreferredCurrency() : "RON");

        Receipt receipt = Receipt.builder()
            .title(title)
            .createdBy(user)
            .currency(resolvedCurrency)
            .totalAmount(BigDecimal.ZERO)
            .category(receiptCategory)
            .status(ReceiptStatus.PENDING_REVIEW)
            .build();

        if (groupId != null) {
            Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
            receipt.setGroup(group);
        }

        return toDto(receiptRepository.save(receipt));
    }

    @Transactional
    public ReceiptDto confirmReview(UUID receiptId, UUID currentUserId) {
        Receipt receipt = findReceipt(receiptId);
        assertAccess(receipt, currentUserId);
        if (receipt.getStatus() == ReceiptStatus.PENDING_REVIEW) {
            if (receipt.getGroup() == null) {
                autoFinalizePersonalReceipt(receipt, receipt.getCreatedBy());
                receiptRepository.save(receipt);
            } else {
                receipt.setStatus(ReceiptStatus.PENDING_ASSIGNMENT);
                receiptRepository.save(receipt);
            }
        }
        return toDto(receipt);
    }

    private void autoFinalizePersonalReceipt(Receipt receipt, User user) {
        for (ReceiptItem item : receipt.getItems()) {
            ItemAssignment assignment = ItemAssignment.builder()
                .item(item)
                .user(user)
                .splitType(SplitType.EQUAL)
                .amountOwed(item.getTotalPrice() != null ? item.getTotalPrice() : BigDecimal.ZERO)
                .build();
            item.getAssignments().add(assignment);
        }
        receipt.setStatus(ReceiptStatus.FINALIZED);
        receipt.getPayments().add(Payment.builder().receipt(receipt).payer(user).build());
    }

    private void populateFromOcr(Receipt receipt, OcrService.OcrResult result) {
        receipt.setCurrency(result.getCurrency());
        receipt.setTotalAmount(result.getTotal());

        if (result.getCategory() != null) {
            try {
                receipt.setCategory(ReceiptCategory.valueOf(result.getCategory().toUpperCase()));
            } catch (IllegalArgumentException e) {
                receipt.setCategory(ReceiptCategory.OTHER);
            }
        } else {
            receipt.setCategory(ReceiptCategory.OTHER);
        }

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
                    .build();
                items.add(item);
            }
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
        if (receipt.getCreatedBy().getId().equals(userId)) return;
        if (receipt.getGroup() != null &&
                receipt.getGroup().getMembers().stream().anyMatch(u -> u.getId().equals(userId))) return;
        throw new BadRequestException("You do not have access to this receipt");
    }

    private void assertIsScanner(Receipt receipt, UUID userId) {
        if (!receipt.getCreatedBy().getId().equals(userId)) {
            throw new BadRequestException("Only the receipt owner can mark payments");
        }
    }

    private boolean allParticipantsPaid(Receipt receipt) {
        Set<UUID> assigneeIds = receipt.getItems().stream()
            .flatMap(item -> item.getAssignments().stream())
            .map(a -> a.getUser().getId())
            .collect(Collectors.toSet());
        Set<UUID> paidIds = receipt.getPayments().stream()
            .map(p -> p.getPayer().getId()).collect(Collectors.toSet());
        return !assigneeIds.isEmpty() && paidIds.containsAll(assigneeIds);
    }

    // ---- DTO mapping ----

    private ReceiptDto toDto(Receipt receipt) {
        List<ReceiptItemDto> itemDtos = receipt.getItems().stream()
            .map(this::toItemDto).toList();

        return new ReceiptDto(
            receipt.getId(),
            receipt.getTitle(),
            receipt.getCreatedBy().getId(),
            receipt.getCreatedBy().getName(),
            receipt.getCreatedBy().getRevolutTag(),
            receipt.getGroup() != null ? receipt.getGroup().getId() : null,
            receipt.getGroup() != null ? receipt.getGroup().getName() : null,
            receipt.getTotalAmount(),
            receipt.getCurrency(),
            receipt.getCategory(),
            receipt.getStatus(),
            receipt.getCreatedAt(),
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
            assignments
        );
    }
}
