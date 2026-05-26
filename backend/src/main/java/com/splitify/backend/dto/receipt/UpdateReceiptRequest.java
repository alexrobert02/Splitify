package com.splitify.backend.dto.receipt;

import lombok.Data;

@Data
public class UpdateReceiptRequest {
    private String title;
    private String currency;
}
