package com.fooddelivery.user.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "password_reset_tokens", indexes = @Index(name = "idx_reset_user", columnList = "userId"),
        uniqueConstraints = @UniqueConstraint(name = "uk_reset_hash", columnNames = "tokenHash"))
@Getter @Setter @NoArgsConstructor
public class PasswordResetToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long userId;
    @Column(nullable = false, length = 64) private String tokenHash;
    @Column(nullable = false) private Instant expiresAt;
    @Column(nullable = false) private boolean used;
}
