package com.hrportal.common.security;

import java.util.Optional;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Static accessor for the authenticated caller (read from the SecurityContext). */
public final class CurrentUser {
    private CurrentUser() {
    }

    public static Optional<AuthenticatedUser> get() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AuthenticatedUser u ? Optional.of(u) : Optional.empty();
    }

    public static AuthenticatedUser require() {
        return get().orElseThrow(() -> new com.hrportal.common.exception.UnauthorizedException("Authentication required"));
    }

    public static String userId() {
        return get().map(AuthenticatedUser::userId).orElse(null);
    }

    public static String employeeId() {
        return get().map(AuthenticatedUser::employeeId).orElse(null);
    }

    public static String username() {
        return get().map(AuthenticatedUser::username).orElse("system");
    }

    /** Raw bearer token - propagated on service-to-service calls so downstream RBAC still applies. */
    public static String token() {
        return get().map(AuthenticatedUser::token).orElse(null);
    }

    public static boolean hasRole(Role role) {
        return get().map(u -> u.hasRole(role)).orElse(false);
    }

    public static boolean hasAnyRole(Role... roles) {
        return get().map(u -> u.hasAnyRole(roles)).orElse(false);
    }

    public static boolean isHr() {
        return hasAnyRole(Role.HR_ADMIN, Role.SUPER_ADMIN);
    }

    /** Short text used as created-by / updated-by: the employee id when known, otherwise the username. */
    public static String auditName() {
        return get().map(u -> u.employeeId() != null ? u.employeeId() : u.username()).orElse("system");
    }
}
