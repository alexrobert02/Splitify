package com.splitify.backend.repository;

import com.splitify.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Modifying(clearAutomatically = true)
    @Query(value = "DELETE FROM user_push_tokens WHERE token = :token AND user_id <> :userId", nativeQuery = true)
    void deleteTokenFromOtherUsers(@Param("token") String token, @Param("userId") UUID userId);
}