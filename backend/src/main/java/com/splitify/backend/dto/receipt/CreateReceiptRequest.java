package com.splitify.backend.dto.receipt;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateReceiptRequest {

    @Size(max = 255)
    private String title;

    private UUID groupId;
}
