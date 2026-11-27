package com.fooddelivery.common.security;

import com.fooddelivery.common.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class SecurityUtils {
    private SecurityUtils() {}

    public static Optional<AuthUser> currentUser() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AuthUser u ? Optional.of(u) : Optional.empty();
    }

    public static AuthUser requireUser() {
        return currentUser().orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required"));
    }
}
