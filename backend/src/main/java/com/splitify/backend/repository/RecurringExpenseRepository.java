package com.splitify.backend.repository;

import com.splitify.backend.entity.RecurringExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, UUID> {

    @Query("SELECT r FROM RecurringExpense r JOIN FETCH r.participants WHERE r.createdBy.id = :createdById ORDER BY r.createdAt DESC")
    List<RecurringExpense> findByCreatedByIdOrderByCreatedAtDesc(UUID createdById);

    @Query("SELECT r FROM RecurringExpense r JOIN FETCH r.participants WHERE r.active = true AND r.nextRunAt <= :today")
    List<RecurringExpense> findDueExpenses(LocalDate today);
}
