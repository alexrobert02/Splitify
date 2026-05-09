package com.splitify.backend.dto.receipt;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateReceiptItemRequest {

    @NotBlank
    private String name;

    @DecimalMin("0")
    private BigDecimal quantity;

    @DecimalMin("0")
    private BigDecimal unitPrice;

    @DecimalMin("0")
    private BigDecimal totalPrice;
}
