package com.splitify.backend.dto.receipt;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ReceiptImageDto {
    private String imageBase64;
    private String imageMimeType;
}
