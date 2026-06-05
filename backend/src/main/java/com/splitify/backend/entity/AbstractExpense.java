package com.splitify.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

@MappedSuperclass
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public abstract class AbstractExpense extends BaseEntity {

    protected String title;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    protected User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    protected Group group;

    @Column(precision = 10, scale = 2)
    protected BigDecimal totalAmount;

    @Column(length = 3)
    protected String currency;

    @Enumerated(EnumType.STRING)
    protected ReceiptCategory category;
}
