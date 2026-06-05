package com.splitify.backend.repository;

import com.splitify.backend.entity.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ReceiptRepository extends JpaRepository<Receipt, UUID> {
    List<Receipt> findByCreatedByIdOrderByCreatedAtDesc(UUID userId);
    List<Receipt> findByGroupIdOrderByCreatedAtDesc(UUID groupId);
}
