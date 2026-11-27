package com.studentmgmt.gateway.security;

import org.springframework.stereotype.Component;

import java.util.List;

/**
 * AUTHORIZATION (as opposed to authentication, which JwtUtil/GatewayAuthFilter
 * handle): given a request that already carries a proven identity and role,
 * decide whether that role may perform this specific method+path.
 *
 * Deliberately a plain class with no Spring/reactive/HTTP types anywhere in
 * its signature — every rule can be unit tested with three strings and a
 * boolean, no WebTestClient or mocked ServerWebExchange required.
 *
 * Rule of thumb encoded below: creating/editing/deleting Student or Course
 * master data is an ADMIN-only operation; students can read everything and
 * manage their own enrollments. The first matching rule wins; if nothing
 * matches, the request is allowed (any authenticated user may proceed) —
 * GatewayAuthFilter has already guaranteed "authenticated" by this point,
 * this class only ever narrows further for specific write operations.
 */
@Component
public class AuthorizationPolicy {

    private record Rule(String method, String pathPrefix, String requiredRole) {
        boolean matches(String method, String path) {
            return this.method.equalsIgnoreCase(method) && path.startsWith(pathPrefix);
        }
    }

    private static final List<Rule> RULES = List.of(
            new Rule("POST",   "/api/students",     "ADMIN"),
            new Rule("PUT",    "/api/students",     "ADMIN"),
            new Rule("DELETE", "/api/students",     "ADMIN"),
            new Rule("POST",   "/api/courses",      "ADMIN"),
            new Rule("PUT",    "/api/courses",      "ADMIN"),
            new Rule("DELETE", "/api/courses",      "ADMIN"),
            new Rule("PUT",    "/api/enrollments",  "ADMIN"),
            new Rule("DELETE", "/api/enrollments",  "ADMIN"),
            new Rule("POST",   "/api/notifications/admin", "ADMIN")
    );

    public boolean isAllowed(String method, String path, String role) {
        for (Rule rule : RULES) {
            if (rule.matches(method, path)) {
                return rule.requiredRole().equalsIgnoreCase(role);
            }
        }
        return true;
    }
}
