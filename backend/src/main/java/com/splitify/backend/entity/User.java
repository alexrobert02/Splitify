package com.splitify.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

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

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
        name = "user_push_tokens",
        joinColumns = @JoinColumn(name = "user_id"),
        uniqueConstraints = @UniqueConstraint(columnNames = "token")
    )
    @Column(name = "token", nullable = false)
    @Builder.Default
    private Set<String> pushTokens = new HashSet<>();

    @CreationTimestamp
    private LocalDateTime createdAt;
}