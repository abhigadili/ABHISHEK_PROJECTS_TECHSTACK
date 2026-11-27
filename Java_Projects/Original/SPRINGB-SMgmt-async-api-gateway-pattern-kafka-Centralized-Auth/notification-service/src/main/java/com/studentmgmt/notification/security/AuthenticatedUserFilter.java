package com.studentmgmt.notification.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Reads the X-Authenticated-User header that api-gateway's GatewayAuthFilter
 * already validated and injected — this service never parses a JWT or knows
 * any signing secret. Requests that bypass the gateway (hit this service's
 * port directly) simply won't have the header, and WhoAmIController falls
 * back to "anonymous".
 */
@Component
public class AuthenticatedUserFilter extends OncePerRequestFilter {

    public static final String ATTRIBUTE_NAME = "authenticatedUser";
    private static final String ANONYMOUS = "anonymous";

    private static final Logger log = LoggerFactory.getLogger(AuthenticatedUserFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authenticatedUser = request.getHeader("X-Authenticated-User");
        if (authenticatedUser == null || authenticatedUser.isBlank()) {
            authenticatedUser = ANONYMOUS;
        }
        request.setAttribute(ATTRIBUTE_NAME, authenticatedUser);
        log.info("Request to {} authenticated as: {}", request.getRequestURI(), authenticatedUser);
        filterChain.doFilter(request, response);
    }
}
