package com.studentmgmt.student.security;

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
 * This is the answer to "how does a backend service access the identity the
 * gateway already authenticated": it doesn't parse a JWT or know any
 * signing secret at all. It just reads the X-Authenticated-User header that
 * GatewayAuthFilter (in api-gateway) already validated and injected, and
 * makes it available to controllers via a request attribute. Requests that
 * bypass the gateway entirely (hit this service's port directly) simply
 * won't have the header — WhoAmIController falls back to "anonymous" in
 * that case, which is expected: this service enforces nothing itself, the
 * gateway is the only checkpoint.
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
