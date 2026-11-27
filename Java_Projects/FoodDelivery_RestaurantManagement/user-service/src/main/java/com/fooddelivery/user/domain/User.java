package com.fooddelivery.user.domain;

import com.fooddelivery.common.jpa.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

@Entity
@Table(name = "users",
        uniqueConstraints = {@UniqueConstraint(name = "uk_users_username", columnNames = "username"),
                @UniqueConstraint(name = "uk_users_email", columnNames = "email")},
        indexes = @Index(name = "idx_users_status", columnList = "status"))
@Getter @Setter @NoArgsConstructor
public class User extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 50)
    private String username;
    @Column(nullable = false, length = 150)
    private String email;
    @Column(nullable = false, length = 100)
    private String passwordHash;
    @Column(nullable = false, length = 120)
    private String fullName;
    @Column(length = 20)
    private String phone;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private UserStatus status = UserStatus.ACTIVE;
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING) @Column(name = "role", length = 24)
    private Set<Role> roles = EnumSet.noneOf(Role.class);
    private Instant lastLoginAt;
    @Version
    private Long version;
}
