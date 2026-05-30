package com.splitify.backend.dto.recurring;

import com.splitify.backend.entity.SplitType;
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
    private UUID userId;
    private String userName;
    private SplitType splitType;
    private BigDecimal splitValue;
}
