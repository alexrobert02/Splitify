package com.splitify.backend.service;

import com.splitify.backend.dto.group.CreateGroupRequest;
import com.splitify.backend.dto.group.GroupDto;
import com.splitify.backend.dto.user.UserDto;
import com.splitify.backend.entity.Group;
import com.splitify.backend.entity.NotificationType;
import com.splitify.backend.entity.User;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.GroupRepository;
import com.splitify.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public GroupDto createGroup(UUID currentUserId, CreateGroupRequest request) {
        User creator = findUser(currentUserId);

        Group group = Group.builder()
            .name(request.getName())
            .description(request.getDescription())
            .createdBy(creator)
            .build();
        group.getMembers().add(creator);
        groupRepository.save(group);

        return toDto(group);
    }

    public List<GroupDto> getMyGroups(UUID currentUserId) {
        return groupRepository.findGroupsByMemberId(currentUserId)
            .stream().map(this::toDto).toList();
    }

    public GroupDto getGroup(UUID groupId, UUID currentUserId) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);
        return toDto(group);
    }

    @Transactional
    public GroupDto addMember(UUID groupId, UUID currentUserId, String email) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);

        User newMember = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        if (group.getMembers().stream().anyMatch(u -> u.getId().equals(newMember.getId()))) {
            throw new BadRequestException("User is already a member of this group");
        }

        group.getMembers().add(newMember);
        groupRepository.save(group);

        User adder = findUser(currentUserId);
        notificationService.sendNotification(
            newMember,
            NotificationType.GROUP_ADDED,
            "Added to group",
            adder.getName() + " added you to \"" + group.getName() + "\"",
            groupId.toString()
        );

        return toDto(group);
    }

    @Transactional
    public void removeMember(UUID groupId, UUID currentUserId, UUID targetUserId) {
        Group group = findGroup(groupId);
        assertMember(group, currentUserId);

        boolean removed = group.getMembers().removeIf(u -> u.getId().equals(targetUserId));
        if (!removed) {
            throw new ResourceNotFoundException("User is not a member of this group");
        }
        groupRepository.save(group);
    }

    @Transactional
    public void deleteGroup(UUID groupId, UUID currentUserId) {
        Group group = findGroup(groupId);
        if (!group.getCreatedBy().getId().equals(currentUserId)) {
            throw new BadRequestException("Only the group creator can delete the group");
        }
        groupRepository.delete(group);
    }

    private Group findGroup(UUID id) {
        return groupRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Group not found"));
    }

    private User findUser(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void assertMember(Group group, UUID userId) {
        if (group.getMembers().stream().noneMatch(u -> u.getId().equals(userId))) {
            throw new BadRequestException("You are not a member of this group");
        }
    }

    private GroupDto toDto(Group group) {
        List<UserDto> memberDtos = group.getMembers().stream()
            .map(UserService::toDto)
            .toList();

        return new GroupDto(
            group.getId(),
            group.getName(),
            group.getDescription(),
            group.getCreatedBy().getId(),
            group.getCreatedBy().getName(),
            group.getCreatedAt(),
            memberDtos
        );
    }
}
