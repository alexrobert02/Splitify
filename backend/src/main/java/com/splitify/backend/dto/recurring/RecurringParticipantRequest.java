package com.splitify.backend.dto.recurring;

import com.splitify.backend.entity.SplitType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class RecurringParticipantRequest {
    @NotNull
    private UUID userId;
    @NotNull
    private SplitType splitType;
    private BigDecimal splitValue;
}
