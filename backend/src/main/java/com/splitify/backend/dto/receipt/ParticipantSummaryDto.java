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
public class ParticipantSummaryDto {
    private UUID userId;
    private String name;
    private String email;
    private BigDecimal totalOwed;
    private List<ItemContributionDto> itemBreakdown;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemContributionDto {
        private UUID itemId;
        private String itemName;
        private BigDecimal amountOwed;
    }
}
