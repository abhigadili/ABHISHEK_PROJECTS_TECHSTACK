package com.studentmgmt.notification.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(20)
public class AuthenticatedUserFilter extends OncePerRequestFilter {

    public static final String USER_ATTRIBUTE = "authenticatedUser";
    public static final String ROLE_ATTRIBUTE = "authenticatedRole";
    private static final String ANONYMOUS = "anonymous";

    private static final Logger log = LoggerFactory.getLogger(AuthenticatedUserFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authenticatedUser = request.getHeader("X-Authenticated-User");
        if (authenticatedUser == null || authenticatedUser.isBlank()) {
            authenticatedUser = ANONYMOUS;
        }
        String role = request.getHeader("X-Authenticated-Role");
        request.setAttribute(USER_ATTRIBUTE, authenticatedUser);
        request.setAttribute(ROLE_ATTRIBUTE, role);
        log.info("Request to {} authenticated as: {} (role={})", request.getRequestURI(), authenticatedUser, role);
        filterChain.doFilter(request, response);
    }
}
