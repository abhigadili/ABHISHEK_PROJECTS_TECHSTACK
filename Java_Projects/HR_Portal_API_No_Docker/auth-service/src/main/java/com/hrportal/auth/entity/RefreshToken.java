package com.hrportal.auth.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Only the SHA-256 hash of the refresh token is stored - a database leak does not reveal usable tokens. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "refresh_tokens", indexes = @Index(name = "idx_refresh_user", columnList = "userId"))
public class RefreshToken extends BaseEntity {
    @Column(nullable = false, length = 36)
    private String userId;
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;
    @Column(length = 64)
    private String accessTokenId;
    @Column(nullable = false)
    private Instant expiresAt;
    private Instant revokedAt;
    @Column(length = 64)
    private String ipAddress;
}
