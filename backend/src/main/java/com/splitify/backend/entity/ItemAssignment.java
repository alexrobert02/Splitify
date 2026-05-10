package com.splitify.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(
    name = "item_assignments",
    uniqueConstraints = @UniqueConstraint(columnNames = {"item_id", "user_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private ReceiptItem item;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SplitType splitType;

    // Percentage (0-100) for PERCENTAGE, fixed amount for FIXED, unit count for COUNT, null for EQUAL
    @Column(precision = 10, scale = 4)
    private BigDecimal splitValue;

    @Column(precision = 10, scale = 2)
    private BigDecimal amountOwed;
}