package com.example.common.security;

import java.util.List;

/** Principal extracted from a validated JWT. {@code studentId} is only set for STUDENT users. */
public record AuthenticatedUser(Long userId, String username, List<String> roles, Long studentId) {
    public boolean hasRole(String role) { return roles.contains(role); }
    public boolean isStaffOrAdmin() { return hasRole("ADMIN") || hasRole("STAFF") || hasRole("SERVICE"); }
}
