package com.splitify.backend.repository;

import com.splitify.backend.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface GroupRepository extends JpaRepository<Group, UUID> {

    @Query("SELECT g FROM Group g JOIN g.members u WHERE u.id = :userId")
    List<Group> findGroupsByMemberId(UUID userId);
}