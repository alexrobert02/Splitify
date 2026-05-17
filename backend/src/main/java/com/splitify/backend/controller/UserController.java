package com.splitify.backend.controller;

import com.splitify.backend.dto.user.UpdatePushTokenRequest;
import com.splitify.backend.dto.user.UpdateUserRequest;
import com.splitify.backend.dto.user.UserDto;
import com.splitify.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserDto> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userService.getProfile(currentUserId(userDetails)));
    }

    @PutMapping("/me")
    public ResponseEntity<UserDto> updateProfile(@AuthenticationPrincipal UserDetails userDetails,
                                                  @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateProfile(currentUserId(userDetails), request));
    }

    @PutMapping("/me/push-token")
    public ResponseEntity<Void> addPushToken(@AuthenticationPrincipal UserDetails userDetails,
                                              @RequestBody UpdatePushTokenRequest request) {
        userService.addPushToken(currentUserId(userDetails), request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/me/push-token")
    public ResponseEntity<Void> removePushToken(@AuthenticationPrincipal UserDetails userDetails,
                                                 @RequestBody UpdatePushTokenRequest request) {
        userService.removePushToken(currentUserId(userDetails), request);
        return ResponseEntity.noContent().build();
    }

    private UUID currentUserId(UserDetails userDetails) {
        return UUID.fromString(userDetails.getUsername());
    }
}
