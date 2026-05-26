package com.splitify.backend.dto.user;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateUserRequest {

    @Size(min = 2, max = 100)
    private String name;

    @Size(min = 6, max = 100)
    private String password;

    @Size(max = 100)
    private String revolutTag;

    @Pattern(regexp = "[A-Z]{3}", message = "Currency must be a 3-letter uppercase ISO code")
    private String preferredCurrency;
}
