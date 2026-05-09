package com.splitify.backend.dto.receipt;

import com.splitify.backend.entity.SplitType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentDto {
    private UUID id;
    private UUID userId;
    private String userName;
    private SplitType splitType;
    private BigDecimal splitValue;
    private BigDecimal amountOwed;
}
