package com.studentmgmt.student.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Gatekeeper for every request except /auth/**. There is no Spring Security
 * dependency here on purpose — OncePerRequestFilter lives in spring-web
 * (already pulled in by spring-boot-starter-web), and all this needs to do
 * is answer "does this request carry a JWT signed with our shared secret?".
 * Spring Boot auto-registers any Filter bean, so no FilterRegistrationBean
 * is needed — the @Component annotation alone wires this into every request.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header == null || !header.startsWith("Bearer ")) {
            reject(response, "Missing Authorization: Bearer <token> header");
            return;
        }

        String token = header.substring("Bearer ".length());
        if (!jwtUtil.isValid(token)) {
            reject(response, "Invalid or expired token");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        // Filters run before @RestControllerAdvice ever sees the request, so
        // the JSON error body has to be written by hand here.
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"" + message + "\"}");
    }
}
