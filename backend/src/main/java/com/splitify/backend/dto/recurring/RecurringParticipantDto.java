package com.splitify.backend.dto.recurring;

import com.splitify.backend.entity.SplitType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecurringParticipantDto {
    @NotNull
    private UUID userId;
    private String userName;
    @NotNull
    private SplitType splitType;
    private BigDecimal splitValue;
}
