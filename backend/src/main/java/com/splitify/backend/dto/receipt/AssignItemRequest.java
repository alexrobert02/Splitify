package com.splitify.backend.dto.receipt;

import com.splitify.backend.entity.SplitType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class AssignItemRequest {

    @NotNull
    private List<AssigneeEntry> assignees;

    @Data
    public static class AssigneeEntry {

        @NotNull
        private UUID userId;

        @NotNull
        private SplitType splitType;

        // Required for PERCENTAGE, FIXED, and COUNT; omit for EQUAL
        private BigDecimal splitValue;
    }
}
