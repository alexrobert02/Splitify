package com.splitify.backend.service;

import com.splitify.backend.dto.group.*;
import com.splitify.backend.entity.Group;
import com.splitify.backend.entity.GroupMember;
import com.splitify.backend.entity.User;
import com.splitify.backend.exception.BadRequestException;
import com.splitify.backend.exception.ResourceNotFoundException;
import com.splitify.backend.repository.GroupMemberRepository;
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
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public GroupDto createGroup(UUID currentUserId, CreateGroupRequest request) {
        User creator = findUser(currentUserId);

        Group group = Group.builder()
            .name(request.getName())
            .description(request.getDescription())
            .createdBy(creator)
            .build();
        groupRepository.save(group);

        GroupMember creatorMember = GroupMember.builder()
            .group(group)
            .user(creator)
            .build();
        groupMemberRepository.save(creatorMember);

        return toDto(group, List.of(creatorMember));
    }

    public List<GroupDto> getMyGroups(UUID currentUserId) {
        List<Group> groups = groupRepository.findGroupsByMemberId(currentUserId);
        return groups.stream().map(g -> {
            List<GroupMember> members = groupMemberRepository.findByGroupId(g.getId());
            return toDto(g, members);
        }).toList();
    }

    public GroupDto getGroup(UUID groupId, UUID currentUserId) {
        Group group = findGroup(groupId);
        assertMember(groupId, currentUserId);
        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        return toDto(group, members);
    }

    @Transactional
    public GroupDto addMember(UUID groupId, UUID currentUserId, AddMemberRequest request) {
        Group group = findGroup(groupId);
        assertMember(groupId, currentUserId);

        User newMember = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.getEmail()));

        if (groupMemberRepository.existsByGroupIdAndUserId(groupId, newMember.getId())) {
            throw new BadRequestException("User is already a member of this group");
        }

        groupMemberRepository.save(GroupMember.builder().group(group).user(newMember).build());

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        return toDto(group, members);
    }

    @Transactional
    public void removeMember(UUID groupId, UUID currentUserId, UUID targetUserId) {
        findGroup(groupId);
        assertMember(groupId, currentUserId);

        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, targetUserId)) {
            throw new ResourceNotFoundException("User is not a member of this group");
        }

        groupMemberRepository.deleteByGroupIdAndUserId(groupId, targetUserId);
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

    private void assertMember(UUID groupId, UUID userId) {
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw new BadRequestException("You are not a member of this group");
        }
    }

    private GroupDto toDto(Group group, List<GroupMember> members) {
        List<GroupMemberDto> memberDtos = members.stream()
            .map(m -> new GroupMemberDto(
                m.getUser().getId(),
                m.getUser().getName(),
                m.getUser().getEmail(),
                m.getJoinedAt()
            ))
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
