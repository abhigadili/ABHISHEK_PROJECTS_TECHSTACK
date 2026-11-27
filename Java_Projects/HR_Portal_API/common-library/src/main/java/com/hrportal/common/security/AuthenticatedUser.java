package com.hrportal.common.security;

import java.util.Set;

/** Caller identity extracted from a validated JWT (principal of the SecurityContext). */
public record AuthenticatedUser(String userId, String username, String employeeId, String email,
                                Set<String> roles, Set<String> permissions, boolean mustChangePassword,
                                String tokenId, String token) {

    public boolean hasRole(Role role) {
        return roles.contains(role.name());
    }

    public boolean hasAnyRole(Role... any) {
        for (Role r : any) if (roles.contains(r.name())) return true;
        return false;
    }
}
