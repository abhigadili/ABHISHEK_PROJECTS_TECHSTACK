package com.fooddelivery.user.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Only a SHA-256 hash of the refresh token is stored: a database leak does not leak usable tokens. */
@Entity
@Table(name = "refresh_tokens", indexes = @Index(name = "idx_refresh_user", columnList = "userId"),
        uniqueConstraints = @UniqueConstraint(name = "uk_refresh_hash", columnNames = "tokenHash"))
@Getter @Setter @NoArgsConstructor
public class RefreshToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long userId;
    @Column(nullable = false, length = 64) private String tokenHash;
    @Column(nullable = false) private Instant expiresAt;
    @Column(nullable = false) private boolean revoked;
    @Column(nullable = false) private Instant createdAt = Instant.now();
}
