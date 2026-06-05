package com.splitify.backend.dto.recurring;

import com.splitify.backend.entity.ReceiptCategory;
import com.splitify.backend.entity.RecurrenceFrequency;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateRecurringExpenseRequest {
    @NotBlank
    private String title;

    @NotNull
    @Positive
    private BigDecimal totalAmount;

    @NotBlank
    private String currency;

    private ReceiptCategory category;

    private UUID groupId;

    @NotNull
    private RecurrenceFrequency frequency;

    @NotNull
    private LocalDate startDate;

    @Valid
    @NotNull
    private List<RecurringParticipantDto> participants;
}
