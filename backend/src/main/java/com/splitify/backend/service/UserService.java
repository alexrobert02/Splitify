package com.splitify.backend.service;

import com.splitify.backend.dto.user.UpdatePushTokenRequest;
import com.splitify.backend.dto.user.UpdateUserRequest;
import com.splitify.backend.dto.user.UserDto;
import com.splitify.backend.entity.User;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserDto getProfile(UUID userId) {
        User user = findUser(userId);
        return toDto(user);
    }

    @Transactional
    public UserDto updateProfile(UUID userId, UpdateUserRequest request) {
        User user = findUser(userId);

        if (StringUtils.hasText(request.getName())) {
            user.setName(request.getName());
        }
        if (StringUtils.hasText(request.getPassword())) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getRevolutTag() != null) {
            user.setRevolutTag(request.getRevolutTag().isBlank() ? null : request.getRevolutTag().trim());
        }

        return toDto(userRepository.save(user));
    }

    @Transactional
    public void updatePushToken(UUID userId, UpdatePushTokenRequest request) {
        User user = findUser(userId);
        user.setPushToken(request.getPushToken());
        userRepository.save(user);
    }

    private User findUser(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public static UserDto toDto(User user) {
        return new UserDto(user.getId(), user.getEmail(), user.getName(), user.getCreatedAt(), user.getRevolutTag());
    }
}
