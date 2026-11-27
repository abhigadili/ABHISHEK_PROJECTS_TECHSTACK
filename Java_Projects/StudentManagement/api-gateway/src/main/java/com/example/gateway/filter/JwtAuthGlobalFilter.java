package com.example.gateway.filter;

import com.example.common.security.JwtTokenService;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Edge authentication: every non-public route needs a valid, unexpired JWT, otherwise the request never reaches a service (401).
 * Fine-grained role checks are enforced by each service (defence in depth); the original Authorization header is forwarded.
 */
@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {
    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final List<String> PUBLIC_POST = List.of("/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout");
    private static final List<String> PUBLIC_ANY = List.of("/actuator/**", "/fallback/**", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/docs/**", "/webjars/**");

    private final JwtTokenService tokens;

    public JwtAuthGlobalFilter(JwtTokenService tokens) { this.tokens = tokens; }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        HttpMethod method = exchange.getRequest().getMethod();
        if (HttpMethod.OPTIONS.equals(method) || isPublic(path, method)) return chain.filter(exchange);

        String header = exchange.getRequest().getHeaders().getFirst("Authorization");
        if (header != null && header.startsWith("Bearer ") && tokens.parse(header.substring(7)).isPresent()) {
            return chain.filter(exchange);
        }
        var res = exchange.getResponse();
        res.setStatusCode(HttpStatus.UNAUTHORIZED);
        res.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"timestamp\":\"" + Instant.now() + "\",\"status\":401,\"error\":\"Unauthorized\",\"message\":\"Missing, invalid or expired token\",\"path\":\"" + path + "\"}";
        DataBuffer buf = res.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return res.writeWith(Mono.just(buf));
    }

    static boolean isPublic(String path, HttpMethod method) {
        if (HttpMethod.POST.equals(method) && PUBLIC_POST.contains(path)) return true;
        return PUBLIC_ANY.stream().anyMatch(p -> MATCHER.match(p, path));
    }

    @Override
    public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 10; }
}
