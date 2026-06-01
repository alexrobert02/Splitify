package com.splitify.backend.dto.receipt;

import com.splitify.backend.entity.ReceiptCategory;
import lombok.Data;

@Data
public class UpdateReceiptRequest {
    private String title;
    private String currency;
    private ReceiptCategory category;
}
