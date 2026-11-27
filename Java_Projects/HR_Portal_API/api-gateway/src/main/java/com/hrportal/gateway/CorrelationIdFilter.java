package com.hrportal.gateway;

import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

/**
 * GLOBAL FILTER #1 (header propagation + correlation id): accepts a well-formed X-Correlation-Id from the client or generates one, forwards it to
 * the service (together with X-Forwarded-For) and returns it on the response so a user can quote it when reporting a problem.
 */
@Component
public class CorrelationIdFilter implements GlobalFilter, Ordered {
    public static final String HEADER = "X-Correlation-Id";
    private static final Pattern VALID = Pattern.compile("^[A-Za-z0-9._-]{8,64}$");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst(HEADER);
        String id = incoming != null && VALID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        String ip = exchange.getRequest().getRemoteAddress() == null ? "unknown" : exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
        ServerHttpRequest request = exchange.getRequest().mutate().header(HEADER, id).header("X-Forwarded-For", ip).build();
        String correlationId = id;
        // beforeCommit: runs after the service's own response headers were merged, so the header appears exactly once
        exchange.getResponse().beforeCommit(() -> {
            exchange.getResponse().getHeaders().set(HEADER, correlationId);
            return Mono.empty();
        });
        return chain.filter(exchange.mutate().request(request).build());
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
