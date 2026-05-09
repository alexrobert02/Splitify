package com.splitify.backend.dto.group;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateGroupRequest {

    @NotBlank
    @Size(min = 1, max = 100)
    private String name;

    @Size(max = 255)
    private String description;
}
