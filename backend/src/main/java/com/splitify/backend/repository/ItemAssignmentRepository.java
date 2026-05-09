package com.splitify.backend.repository;

import com.splitify.backend.entity.ItemAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ItemAssignmentRepository extends JpaRepository<ItemAssignment, UUID> {
    List<ItemAssignment> findByItemId(UUID itemId);
    void deleteByItemId(UUID itemId);
}
