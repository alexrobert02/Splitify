package com.splitify.backend.dto.group;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupMemberDto {
    private UUID userId;
    private String name;
    private String email;
    private LocalDateTime joinedAt;
}
