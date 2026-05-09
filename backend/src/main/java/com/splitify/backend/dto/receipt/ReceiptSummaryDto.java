package com.splitify.backend.dto.receipt;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReceiptSummaryDto {
    private UUID receiptId;
    private String title;
    private BigDecimal totalAmount;
    private String currency;
    private BigDecimal assignedAmount;
    private BigDecimal unassignedAmount;
    private List<ParticipantSummaryDto> participants;
}
