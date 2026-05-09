package com.splitify.backend.dto.group;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupDto {
    private UUID id;
    private String name;
    private String description;
    private UUID createdById;
    private String createdByName;
    private LocalDateTime createdAt;
    private List<GroupMemberDto> members;
}
