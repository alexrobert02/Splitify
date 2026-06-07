package com.splitify.backend.controller;

import com.splitify.backend.dto.group.CreateGroupRequest;
import com.splitify.backend.dto.group.GroupDto;
import com.splitify.backend.dto.group.GroupSettlementDto;
import com.splitify.backend.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping
    public ResponseEntity<GroupDto> createGroup(@AuthenticationPrincipal UserDetails userDetails,
                                                 @Valid @RequestBody CreateGroupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(groupService.createGroup(currentUserId(userDetails), request));
    }

    @GetMapping
    public ResponseEntity<List<GroupDto>> getMyGroups(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(groupService.getMyGroups(currentUserId(userDetails)));
    }

    @GetMapping("/{groupId}")
    public ResponseEntity<GroupDto> getGroup(@AuthenticationPrincipal UserDetails userDetails,
                                              @PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.getGroup(groupId, currentUserId(userDetails)));
    }

    @PostMapping("/{groupId}/members")
    public ResponseEntity<GroupDto> addMember(@AuthenticationPrincipal UserDetails userDetails,
                                               @PathVariable UUID groupId,
                                               @RequestBody String email) {
        return ResponseEntity.ok(groupService.addMember(groupId, currentUserId(userDetails), email));
    }

    @DeleteMapping("/{groupId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal UserDetails userDetails,
                                              @PathVariable UUID groupId,
                                              @PathVariable UUID userId) {
        groupService.removeMember(groupId, currentUserId(userDetails), userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/settlement")
    public ResponseEntity<GroupSettlementDto> getGroupSettlement(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.getGroupSettlement(groupId, currentUserId(userDetails)));
    }

    @PostMapping("/{groupId}/settle")
    public ResponseEntity<Void> settleDebt(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId,
            @RequestBody UUID creditorId) {
        groupService.settleDebt(groupId, currentUserId(userDetails), creditorId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(@AuthenticationPrincipal UserDetails userDetails,
                                             @PathVariable UUID groupId) {
        groupService.deleteGroup(groupId, currentUserId(userDetails));
        return ResponseEntity.noContent().build();
    }

    private UUID currentUserId(UserDetails userDetails) {
        return UUID.fromString(userDetails.getUsername());
    }
}
