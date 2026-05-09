package com.splitify.backend.service;

import com.splitify.backend.dto.receipt.AssignItemRequest;
import com.splitify.backend.entity.ItemAssignment;
import com.splitify.backend.entity.ReceiptItem;
import com.splitify.backend.entity.SplitType;
import com.splitify.backend.entity.User;
import com.splitify.backend.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class SplitCalculationService {

    public void calculateAndSetAmounts(ReceiptItem item, List<ItemAssignment> assignments) {
        if (assignments.isEmpty()) return;

        SplitType type = assignments.get(0).getSplitType();

        switch (type) {
            case EQUAL -> calculateEqual(item, assignments);
            case PERCENTAGE -> calculatePercentage(item, assignments);
            case FIXED -> calculateFixed(item, assignments);
        }
    }

    private void calculateEqual(ReceiptItem item, List<ItemAssignment> assignments) {
        BigDecimal total = item.getTotalPrice();
        int count = assignments.size();
        BigDecimal share = total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        BigDecimal remainder = total.subtract(share.multiply(BigDecimal.valueOf(count)));

        for (int i = 0; i < assignments.size(); i++) {
            BigDecimal amount = (i == 0) ? share.add(remainder) : share;
            assignments.get(i).setAmountOwed(amount);
        }
    }

    private void calculatePercentage(ReceiptItem item, List<ItemAssignment> assignments) {
        BigDecimal totalPct = assignments.stream()
            .map(a -> a.getSplitValue() != null ? a.getSplitValue() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalPct.compareTo(new BigDecimal("100")) != 0) {
            throw new BadRequestException("Percentages must sum to 100, got: " + totalPct);
        }

        for (ItemAssignment assignment : assignments) {
            BigDecimal pct = assignment.getSplitValue().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            BigDecimal amount = item.getTotalPrice().multiply(pct).setScale(2, RoundingMode.HALF_UP);
            assignment.setAmountOwed(amount);
        }
    }

    private void calculateFixed(ReceiptItem item, List<ItemAssignment> assignments) {
        BigDecimal totalFixed = assignments.stream()
            .map(a -> a.getSplitValue() != null ? a.getSplitValue() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalFixed.compareTo(item.getTotalPrice()) != 0) {
            throw new BadRequestException(
                "Fixed amounts must sum to item total (" + item.getTotalPrice() + "), got: " + totalFixed
            );
        }

        for (ItemAssignment assignment : assignments) {
            assignment.setAmountOwed(assignment.getSplitValue().setScale(2, RoundingMode.HALF_UP));
        }
    }

    public List<ItemAssignment> buildAssignments(
            ReceiptItem item,
            List<AssignItemRequest.AssigneeEntry> entries,
            List<User> users) {

        List<ItemAssignment> assignments = entries.stream().map(entry -> {
            User user = users.stream()
                .filter(u -> u.getId().equals(entry.getUserId()))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("User not found: " + entry.getUserId()));

            return ItemAssignment.builder()
                .item(item)
                .user(user)
                .splitType(entry.getSplitType())
                .splitValue(entry.getSplitValue())
                .build();
        }).toList();

        calculateAndSetAmounts(item, assignments);
        return assignments;
    }
}
