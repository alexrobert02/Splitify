package com.splitify.backend.controller;

import com.splitify.backend.dto.notification.NotificationDto;
import com.splitify.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<NotificationDto>> getNotifications(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(notificationService.getNotifications(currentUserId(userDetails)));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(notificationService.getUnreadCount(currentUserId(userDetails)));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@AuthenticationPrincipal UserDetails userDetails,
                                            @PathVariable UUID id) {
        notificationService.markAsRead(id, currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(@AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAllAsRead(currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    private UUID currentUserId(UserDetails userDetails) {
        return UUID.fromString(userDetails.getUsername());
    }
}
