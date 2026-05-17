package com.splitify.backend.service;

import com.splitify.backend.dto.notification.NotificationDto;
import com.splitify.backend.entity.Notification;
import com.splitify.backend.entity.NotificationType;
import com.splitify.backend.entity.User;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;

    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

    @Transactional
    public void sendNotification(User recipient, NotificationType type, String title, String body, String relatedEntityId) {
        Notification notification = Notification.builder()
            .recipient(recipient)
            .type(type)
            .title(title)
            .body(body)
            .relatedEntityId(relatedEntityId)
            .build();
        notificationRepository.save(notification);

        if (recipient.getPushToken() != null && !recipient.getPushToken().isBlank()) {
            sendExpoPushNotification(recipient.getPushToken(), title, body, type, relatedEntityId, notification.getId());
        }
    }

    private void sendExpoPushNotification(String token, String title, String body, NotificationType type, String relatedEntityId, UUID notificationId) {
        try {
            String safeTitle = title.replace("\\", "\\\\").replace("\"", "\\\"");
            String safeBody = body.replace("\\", "\\\\").replace("\"", "\\\"");
            String dataField = (relatedEntityId != null)
                ? String.format(",\"data\":{\"type\":\"%s\",\"relatedEntityId\":\"%s\",\"notificationId\":\"%s\"}", type.name(), relatedEntityId, notificationId)
                : String.format(",\"data\":{\"notificationId\":\"%s\"}", notificationId);
            String payload = String.format(
                "{\"to\":\"%s\",\"title\":\"%s\",\"body\":\"%s\",\"sound\":\"default\",\"channelId\":\"default\"%s}",
                token, safeTitle, safeBody, dataField
            );

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://exp.host/--/api/v2/push/send"))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

            HTTP_CLIENT.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(resp -> {
                    log.info("Expo push response status={} body={}", resp.statusCode(), resp.body());
                })
                .exceptionally(e -> { log.error("Push notification failed", e); return null; });
        } catch (Exception e) {
            log.error("Failed to send push notification", e);
        }
    }

    public List<NotificationDto> getNotifications(UUID userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
            .stream().map(this::toDto).toList();
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (!notification.getRecipient().getId().equals(userId)) {
            throw new BadRequestException("Access denied");
        }
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        List<Notification> unread = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId)
            .stream().filter(n -> !n.isRead()).toList();
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByRecipientIdAndReadFalse(userId);
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(
            n.getId(),
            n.getType(),
            n.getTitle(),
            n.getBody(),
            n.getRelatedEntityId(),
            n.isRead(),
            n.getCreatedAt()
        );
    }
}
