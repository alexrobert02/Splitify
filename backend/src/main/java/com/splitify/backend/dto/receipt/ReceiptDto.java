package com.splitify.backend.dto.receipt;

import com.splitify.backend.entity.ReceiptStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReceiptDto {
    private UUID id;
    private String title;
    private UUID scannedById;
    private String scannedByName;
    private String scannedByRevolutTag;
    private UUID groupId;
    private String groupName;
    private BigDecimal totalAmount;
    private String currency;
    private ReceiptStatus status;
    private boolean finalized;
    private LocalDateTime scannedAt;
    private List<ReceiptItemDto> items;
}
