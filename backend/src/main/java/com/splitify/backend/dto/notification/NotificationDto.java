package com.splitify.backend.dto.notification;

import com.splitify.backend.entity.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
public class NotificationDto {
    private UUID id;
    private NotificationType type;
    private String title;
    private String body;
    private String relatedEntityId;
    private boolean read;
    private LocalDateTime createdAt;
}
