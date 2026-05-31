package com.splitify.backend.service;

import com.splitify.backend.dto.recurring.*;
import com.splitify.backend.entity.*;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class RecurringExpenseService {

    private final RecurringExpenseRepository recurringExpenseRepository;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final ReceiptRepository receiptRepository;
    private final PaymentRepository paymentRepository;
    private final NotificationService notificationService;
    private final SplitCalculationService splitCalculationService;

    @Transactional
    public RecurringExpenseDto create(UUID currentUserId, CreateRecurringExpenseRequest request) {
        User creator = findUser(currentUserId);

        if (request.getParticipants() == null || request.getParticipants().isEmpty()) {
            throw new BadRequestException("At least one participant is required");
        }

        SplitType firstType = request.getParticipants().getFirst().getSplitType();
        boolean allSameType = request.getParticipants().stream()
            .allMatch(p -> p.getSplitType() == firstType);
        if (!allSameType) {
            throw new BadRequestException("All participants must use the same split type");
        }

        RecurringExpense expense = RecurringExpense.builder()
            .title(request.getTitle())
            .amount(request.getAmount())
            .currency(request.getCurrency().toUpperCase())
            .category(request.getCategory())
            .createdBy(creator)
            .frequency(request.getFrequency())
            .nextRunAt(request.getStartDate())
            .build();

        if (request.getGroupId() != null) {
            Group group = groupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
            expense.setGroup(group);
        }

        List<RecurringParticipant> participants = new ArrayList<>();
        for (RecurringParticipantRequest p : request.getParticipants()) {
            User user = findUser(p.getUserId());
            participants.add(RecurringParticipant.builder()
                .recurringExpense(expense)
                .user(user)
                .splitType(p.getSplitType())
                .splitValue(p.getSplitValue())
                .build());
        }
        expense.setParticipants(participants);

        RecurringExpense saved = recurringExpenseRepository.save(expense);

        if (!request.getStartDate().isAfter(LocalDate.now())) {
            createReceiptFromExpense(saved);
            saved.setNextRunAt(computeNextRunAt(saved.getNextRunAt(), saved.getFrequency()));
            saved = recurringExpenseRepository.save(saved);
        }

        return toDto(saved);
    }

    public List<RecurringExpenseDto> getMyRecurring(UUID currentUserId) {
        return recurringExpenseRepository.findByCreatedByIdOrderByCreatedAtDesc(currentUserId)
            .stream().map(this::toDto).toList();
    }

    public RecurringExpenseDto getById(UUID id, UUID currentUserId) {
        RecurringExpense expense = findExpense(id);
        if (!expense.getCreatedBy().getId().equals(currentUserId)) {
            throw new BadRequestException("Access denied");
        }
        return toDto(expense);
    }

    @Transactional
    public RecurringExpenseDto toggle(UUID id, UUID currentUserId) {
        RecurringExpense expense = findExpense(id);
        if (!expense.getCreatedBy().getId().equals(currentUserId)) {
            throw new BadRequestException("Access denied");
        }
        expense.setActive(!expense.isActive());
        return toDto(recurringExpenseRepository.save(expense));
    }

    @Transactional
    public void delete(UUID id, UUID currentUserId) {
        RecurringExpense expense = findExpense(id);
        if (!expense.getCreatedBy().getId().equals(currentUserId)) {
            throw new BadRequestException("Access denied");
        }
        recurringExpenseRepository.delete(expense);
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void processOnStartup() {
        log.info("Recurring expense startup check");
        processScheduled();
    }

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void processScheduled() {
        List<RecurringExpense> due = recurringExpenseRepository.findDueExpenses(LocalDate.now());
        log.info("Recurring expense scheduler: {} expense(s) due", due.size());
        for (RecurringExpense expense : due) {
            try {
                createReceiptFromExpense(expense);
                expense.setNextRunAt(computeNextRunAt(expense.getNextRunAt(), expense.getFrequency()));
                recurringExpenseRepository.save(expense);
            } catch (Exception e) {
                log.error("Failed to process recurring expense id={}", expense.getId(), e);
            }
        }
    }

    private void createReceiptFromExpense(RecurringExpense expense) {
        Receipt receipt = Receipt.builder()
            .title(expense.getTitle())
            .scannedBy(expense.getCreatedBy())
            .group(expense.getGroup())
            .totalAmount(expense.getAmount())
            .currency(expense.getCurrency())
            .category(expense.getCategory())
            .status(ReceiptStatus.PENDING_PAYMENT)
            .finalized(true)
            .build();

        ReceiptItem item = ReceiptItem.builder()
            .receipt(receipt)
            .name(expense.getTitle())
            .quantity(BigDecimal.ONE)
            .unitPrice(expense.getAmount())
            .totalPrice(expense.getAmount())
            .position(0)
            .build();

        List<RecurringParticipant> participants = expense.getParticipants();
        List<ItemAssignment> assignments = participants.stream().map(p ->
            ItemAssignment.builder()
                .item(item)
                .user(p.getUser())
                .splitType(p.getSplitType())
                .splitValue(p.getSplitValue())
                .build()
        ).toList();

        splitCalculationService.calculateAndSetAmounts(item, assignments);
        item.getAssignments().addAll(assignments);
        receipt.getItems().add(item);

        receiptRepository.save(receipt);

        // Creator paid upfront — auto-mark as paid
        paymentRepository.save(Payment.builder().receipt(receipt).payer(expense.getCreatedBy()).build());

        // If creator is the only participant, settle immediately
        boolean onlyCreator = participants.stream()
            .allMatch(p -> p.getUser().getId().equals(expense.getCreatedBy().getId()));
        if (onlyCreator) {
            receipt.setStatus(ReceiptStatus.FINALIZED);
            receiptRepository.save(receipt);
        }

        String receiptIdStr = receipt.getId().toString();
        participants.stream()
            .filter(p -> !p.getUser().getId().equals(expense.getCreatedBy().getId()))
            .forEach(p -> notificationService.sendNotification(
                p.getUser(),
                NotificationType.PAYMENT_REQUESTED,
                "Payment due: " + expense.getTitle(),
                expense.getCreatedBy().getName() + " has charged you for " + expense.getTitle(),
                receiptIdStr
            ));

        log.info("Created recurring receipt id={} from expense id={}", receipt.getId(), expense.getId());
    }

    private LocalDate computeNextRunAt(LocalDate current, RecurrenceFrequency frequency) {
        return switch (frequency) {
            case DAILY -> current.plusDays(1);
            case WEEKLY -> current.plusWeeks(1);
            case MONTHLY -> current.plusMonths(1);
            case YEARLY -> current.plusYears(1);
        };
    }

    private RecurringExpenseDto toDto(RecurringExpense e) {
        List<RecurringParticipantDto> participantDtos = e.getParticipants().stream()
            .map(p -> RecurringParticipantDto.builder()
                .userId(p.getUser().getId())
                .userName(p.getUser().getName())
                .splitType(p.getSplitType())
                .splitValue(p.getSplitValue())
                .build())
            .toList();

        return RecurringExpenseDto.builder()
            .id(e.getId())
            .title(e.getTitle())
            .amount(e.getAmount())
            .currency(e.getCurrency())
            .category(e.getCategory())
            .createdById(e.getCreatedBy().getId())
            .createdByName(e.getCreatedBy().getName())
            .groupId(e.getGroup() != null ? e.getGroup().getId() : null)
            .groupName(e.getGroup() != null ? e.getGroup().getName() : null)
            .frequency(e.getFrequency())
            .nextRunAt(e.getNextRunAt())
            .active(e.isActive())
            .participants(participantDtos)
            .createdAt(e.getCreatedAt())
            .build();
    }

    private RecurringExpense findExpense(UUID id) {
        return recurringExpenseRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Recurring expense not found"));
    }

    private User findUser(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}
