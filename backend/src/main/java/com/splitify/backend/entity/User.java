package com.splitify.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@SuperBuilder
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(name = "revolut_tag")
    private String revolutTag;

    @Column(name = "preferred_currency", length = 3)
    private String preferredCurrency = "RON";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
        name = "user_push_tokens",
        joinColumns = @JoinColumn(name = "user_id"),
        uniqueConstraints = @UniqueConstraint(columnNames = "token")
    )
    @Column(name = "token", nullable = false)
    @Builder.Default
    private Set<String> pushTokens = new HashSet<>();
}