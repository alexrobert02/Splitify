package com.splitify.backend.dto.recurring;

import com.splitify.backend.entity.ReceiptCategory;
import com.splitify.backend.entity.RecurrenceFrequency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecurringExpenseDto {
    private UUID id;
    private String title;
    private BigDecimal totalAmount;
    private String currency;
    private ReceiptCategory category;
    private UUID createdById;
    private String createdByName;
    private UUID groupId;
    private String groupName;
    private RecurrenceFrequency frequency;
    private LocalDate nextRunAt;
    private boolean active;
    private List<RecurringParticipantDto> participants;
    private LocalDateTime createdAt;
}
