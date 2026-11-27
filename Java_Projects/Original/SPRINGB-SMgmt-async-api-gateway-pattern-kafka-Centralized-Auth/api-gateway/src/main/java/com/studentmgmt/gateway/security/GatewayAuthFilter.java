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
 * The actual centralized-auth enforcement point. This only ever runs for
 * requests that matched one of the four routes in application.yml — Spring
 * Cloud Gateway only invokes GlobalFilters inside the per-route
 * GatewayFilterChain, so /auth/login (which matches no route) never reaches
 * this class at all, even without the explicit path check below.
 *
 * On success, the validated identity is added as a plain header
 * (X-Authenticated-User) before the request is forwarded — this is how the
 * four backend services "access the token from the centralized service"
 * without ever parsing a JWT or knowing the signing secret themselves.
 *
 * On failure, the response is written and completed right here — the
 * backend service is never called. That's what makes this "centralized":
 * a bad request never gets anywhere near business logic.
 */
@Component
public class GatewayAuthFilter implements GlobalFilter, Ordered {

    private final JwtUtil jwtUtil;

    public GatewayAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (path.startsWith("/auth/")) {
            return chain.filter(exchange);
        }

        String header = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return reject(exchange, "Missing Authorization: Bearer <token> header");
        }

        String token = header.substring("Bearer ".length());
        if (!jwtUtil.isValid(token)) {
            return reject(exchange, "Invalid or expired token");
        }

        String username = jwtUtil.extractUsername(token);
        ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                .header("X-Authenticated-User", username)
                .build();
        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private Mono<Void> reject(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
        String body = "{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    /** Run before the routing filters forward the request downstream. */
    @Override
    public int getOrder() {
        return -1;
    }
}
