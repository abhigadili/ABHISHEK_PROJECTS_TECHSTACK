package com.fooddelivery.common.security;

import java.util.List;

/** The authenticated principal rebuilt from a validated JWT (no database lookup needed in other services). */
public record AuthUser(long userId, String username, List<String> roles, List<String> permissions, String tokenId) {
    public boolean hasRole(String role) { return roles.contains(role); }
    public boolean isAdmin() { return roles.contains(Roles.ADMIN) || roles.contains(Roles.SUPER_ADMIN); }
    public boolean isService() { return roles.contains(Roles.SERVICE); }
}
