package com.cricket.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDateTime;

/**
 * Maps the 'loginusers' table. Exposed read-only via the API — this
 * application does not implement authentication itself, only completeness
 * of DB coverage. Credential fields are never serialised to JSON.
 */
public class LoginUser {

    private Integer id;
    private String name;
    private String email;

    @JsonIgnore
    private String passwordHash;

    private String role;
    private Boolean active;
    private LocalDateTime lastLogin;

    @JsonIgnore
    private String refreshTokenHash;

    @JsonIgnore
    private LocalDateTime refreshTokenExpires;

    private LocalDateTime createdAt;
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
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
