package com.splitify.backend.dto.group;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@AllArgsConstructor
public class DebtDto {
    private UUID fromId;
    private String fromName;
    private UUID toId;
    private String toName;
    private String toRevolutTag;
    private BigDecimal amount;
    private String currency;
}
