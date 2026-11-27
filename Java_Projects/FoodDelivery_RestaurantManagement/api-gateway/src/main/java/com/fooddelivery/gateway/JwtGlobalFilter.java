package com.fooddelivery.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

/**
 * First line of defence: validates the JWT (signature, issuer, expiry, deny-list) and applies coarse authorisation
 * rules per path. Services re-validate the token themselves (defence in depth) and enforce fine-grained rules.
 */
@Component
public class JwtGlobalFilter implements GlobalFilter, Ordered {
    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final List<String> PUBLIC_ANY = List.of("/api/auth/register", "/api/auth/login", "/api/auth/refresh",
            "/api/auth/forgot-password", "/api/auth/reset-password", "/api/payments/callback", "/fallback/**", "/docs/**", "/swagger-ui/**",
            "/swagger-ui.html", "/v3/api-docs/**", "/webjars/**", "/actuator/health/**", "/actuator/info");
    private static final List<String> PUBLIC_GET = List.of("/api/restaurants/**", "/api/menu/**", "/api/search/**",
            "/api/files/**", "/api/reviews/restaurant/**", "/api/reviews/summary/**", "/api/coupons/public/**");
    private static final List<String> ADMIN_ONLY = List.of("/api/admin/**", "/api/kafka/**", "/api/audit/**",
            "/api/logs/**", "/api/monitoring/**");

    private final SecretKey key;
    private final String issuer;
    private final ReactiveStringRedisTemplate redis;

    public JwtGlobalFilter(@Value("${food.jwt.secret}") String secret, @Value("${food.jwt.issuer}") String issuer,
                           ReactiveStringRedisTemplate redis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
        this.redis = redis;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        HttpMethod method = exchange.getRequest().getMethod();
        if (HttpMethod.OPTIONS.equals(method) || matches(PUBLIC_ANY, path)
                || (HttpMethod.GET.equals(method) && matches(PUBLIC_GET, path))) {
            return chain.filter(exchange);
        }
        String auth = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) return reject(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required");
        Claims claims;
        try {
            claims = Jwts.parser().verifyWith(key).requireIssuer(issuer).build().parseSignedClaims(auth.substring(7)).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "Token is invalid or expired");
        }
        if (!"access".equals(claims.get("typ", String.class))) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "TOKEN_INVALID", "An access token is required");
        }
        if (matches(ADMIN_ONLY, path)) {
            List<?> roles = claims.get("roles", List.class);
            if (roles == null || !(roles.contains("ADMIN") || roles.contains("SUPER_ADMIN"))) {
                return reject(exchange, HttpStatus.FORBIDDEN, "FORBIDDEN", "Administrator role required");
            }
        }
        return redis.hasKey("jwt:revoked:" + claims.getId())
                .onErrorReturn(false)           // Redis down: fail open, the service re-checks anyway
                .flatMap(revoked -> revoked
                        ? reject(exchange, HttpStatus.UNAUTHORIZED, "TOKEN_REVOKED", "Token was revoked (logged out)")
                        : chain.filter(exchange));
    }

    private static boolean matches(List<String> patterns, String path) {
        return patterns.stream().anyMatch(p -> MATCHER.match(p, path));
    }

    private Mono<Void> reject(ServerWebExchange ex, HttpStatus status, String code, String message) {
        var res = ex.getResponse();
        res.setStatusCode(status);
        res.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String cid = ex.getRequest().getHeaders().getFirst("X-Correlation-Id");
        String body = "{\"timestamp\":\"" + Instant.now() + "\",\"status\":" + status.value() + ",\"error\":\"" + status.getReasonPhrase()
                + "\",\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"path\":\"" + ex.getRequest().getURI().getPath()
                + "\",\"correlationId\":" + (cid == null ? "null" : "\"" + cid + "\"") + "}";
        DataBuffer buf = res.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return res.writeWith(Mono.just(buf));
    }

    @Override
    public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 10; }
}
