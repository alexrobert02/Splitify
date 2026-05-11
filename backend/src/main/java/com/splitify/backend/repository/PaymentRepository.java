package com.splitify.backend.repository;

import com.splitify.backend.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByReceiptId(UUID receiptId);
    boolean existsByReceiptIdAndPayerId(UUID receiptId, UUID payerId);
    void deleteByReceiptIdAndPayerId(UUID receiptId, UUID payerId);
}
