package com.cricket.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * Maps the 'loginusers' table. Exposed read-only (list/get) via the API —
 * this application does not implement authentication itself, only completeness
 * of DB coverage. Credential fields are never serialised to JSON.
 */
@Entity
@Table(name = "loginusers")
public class LoginUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @NotBlank
    @Size(max = 100)
    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @NotBlank
    @Email
    @Size(max = 255)
    @Column(name = "email", length = 255, nullable = false, unique = true)
    private String email;

    @JsonIgnore
    @Column(name = "password_hash", length = 255, nullable = false)
    private String passwordHash;

    @Column(name = "role", length = 20, nullable = false)
    private String role;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @JsonIgnore
    @Column(name = "refresh_token_hash", length = 64)
    private String refreshTokenHash;

    @JsonIgnore
    @Column(name = "refresh_token_expires")
    private LocalDateTime refreshTokenExpires;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public LoginUser() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getLastLogin() { return lastLogin; }
    public void setLastLogin(LocalDateTime lastLogin) { this.lastLogin = lastLogin; }

    public String getRefreshTokenHash() { return refreshTokenHash; }
    public void setRefreshTokenHash(String refreshTokenHash) { this.refreshTokenHash = refreshTokenHash; }

    public LocalDateTime getRefreshTokenExpires() { return refreshTokenExpires; }
    public void setRefreshTokenExpires(LocalDateTime refreshTokenExpires) { this.refreshTokenExpires = refreshTokenExpires; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
