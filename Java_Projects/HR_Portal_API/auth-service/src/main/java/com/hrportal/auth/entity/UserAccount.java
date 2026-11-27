package com.hrportal.auth.entity;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Login identity. {@code employeeId} is the cross-service reference to the Employee service (no foreign key across databases). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_accounts")
public class UserAccount extends BaseEntity {
    @Column(nullable = false, unique = true, length = 60)
    private String username;
    @Column(nullable = false, unique = true, length = 150)
    private String email;
    @Column(nullable = false, length = 100)
    private String passwordHash;
    @Column(unique = true, length = 36)
    private String employeeId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status = AccountStatus.ACTIVE;
    @Column(nullable = false)
    private int failedAttempts;
    private Instant lockedUntil;
    private Instant lastLoginAt;
    private Instant passwordChangedAt;
    @Column(nullable = false)
    private boolean mustChangePassword;
    @Version
    private long version;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();
}
