package com.splitify.backend.dto.receipt;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateReceiptRequest {

    @Size(max = 255)
    private String title;

    private String currency;

    private UUID groupId;
}
