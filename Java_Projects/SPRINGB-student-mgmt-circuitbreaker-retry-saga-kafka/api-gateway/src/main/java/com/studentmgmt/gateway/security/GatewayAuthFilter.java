package com.studentmgmt.gateway.security;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * The centralized authentication AND authorization enforcement point. Only
 * ever runs for requests that matched one of the routes in application.yml
 * (Spring Cloud Gateway only invokes GlobalFilters inside the per-route
 * GatewayFilterChain) — /auth/login matches no route, so it never reaches
 * this class even without the explicit path check below.
 *
 * Two questions are answered here, in order:
 *   1. AUTHENTICATION — is there a valid, unexpired JWT? (JwtUtil)
 *   2. AUTHORIZATION   — does this token's role allow THIS method+path? (AuthorizationPolicy)
 * A request that fails either check never reaches a backend service — the
 * response is written and completed right here.
 *
 * On success, the validated identity and role are added as plain headers
 * (X-Authenticated-User, X-Authenticated-Role) before the request is
 * forwarded — this is how backend services "see" who's calling without ever
 * parsing a JWT or knowing the signing secret themselves.
 */
@Component
public class GatewayAuthFilter implements GlobalFilter, Ordered {

    private final JwtUtil jwtUtil;
    private final AuthorizationPolicy authorizationPolicy;

    public GatewayAuthFilter(JwtUtil jwtUtil, AuthorizationPolicy authorizationPolicy) {
        this.jwtUtil = jwtUtil;
        this.authorizationPolicy = authorizationPolicy;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();
        if (path.startsWith("/auth/")) {
            return chain.filter(exchange);
        }

        String header = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "Missing Authorization: Bearer <token> header");
        }

        String token = header.substring("Bearer ".length());
        if (!jwtUtil.isValid(token)) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }

        String username = jwtUtil.extractUsername(token);
        String role = jwtUtil.extractRole(token);
        String method = request.getMethod() != null ? request.getMethod().name() : "GET";

        if (!authorizationPolicy.isAllowed(method, path, role)) {
            return reject(exchange, HttpStatus.FORBIDDEN,
                    "Role '" + role + "' is not permitted to " + method + " " + path);
        }

        ServerHttpRequest mutatedRequest = request.mutate()
                .header("X-Authenticated-User", username)
                .header("X-Authenticated-Role", role)
                .build();
        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        String body = "{\"status\":" + status.value() + ",\"error\":\"" + status.getReasonPhrase()
                + "\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    /** Run before the routing filters forward the request downstream. */
    @Override
    public int getOrder() {
        return -1;
    }
}
