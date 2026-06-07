package com.splitify.backend.dto.group;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class GroupSettlementDto {
    private List<DebtDto> debts;
}
