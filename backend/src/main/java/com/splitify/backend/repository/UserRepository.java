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

    @Modifying
    @Query("UPDATE User u SET u.pushToken = null WHERE u.pushToken = :token AND u.id <> :excludeUserId")
    void clearPushTokenFromOtherUsers(@Param("token") String token, @Param("excludeUserId") UUID excludeUserId);
}