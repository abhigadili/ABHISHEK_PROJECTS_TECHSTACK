package com.hospital.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** Read-only view of the authenticated caller, taken from the validated JWT. */
public final class CurrentUser {
    private CurrentUser() {
    }

    private static Jwt jwt() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof Jwt j ? j : null;
    }

    public static Long id() {
        Jwt j = jwt();
        if (j == null) return null;
        Object uid = j.getClaim("uid");
        return uid instanceof Number n ? n.longValue() : null;
    }

    public static String username() {
        Jwt j = jwt();
        return j == null ? null : j.getSubject();
    }

    public static String email() {
        Jwt j = jwt();
        return j == null ? null : j.getClaimAsString("email");
    }

    /** Raw bearer token, propagated on service-to-service calls so downstream RBAC still applies. */
    public static String token() {
        Jwt j = jwt();
        return j == null ? null : j.getTokenValue();
    }

    public static boolean hasRole(Role role) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals("ROLE_" + role.name()));
    }

    public static boolean isAdmin() {
        return hasRole(Role.ADMIN);
    }
}
