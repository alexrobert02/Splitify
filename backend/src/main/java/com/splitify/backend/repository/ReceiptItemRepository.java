package com.splitify.backend.repository;

import com.splitify.backend.entity.ReceiptItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ReceiptItemRepository extends JpaRepository<ReceiptItem, UUID> {
    List<ReceiptItem> findByReceiptIdOrderByPositionAsc(UUID receiptId);
}
