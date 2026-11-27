package com.example.gateway.filter;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/** Ensures every request carries X-Correlation-Id (generated if missing), echoes it in the response and logs one line per request. */
@Component
public class CorrelationIdGlobalFilter implements GlobalFilter, Ordered {
    public static final String HEADER = "X-Correlation-Id";
    private static final Logger log = LoggerFactory.getLogger("gateway.request");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String incoming = exchange.getRequest().getHeaders().getFirst(HEADER);
        String id = incoming == null || incoming.isBlank() ? UUID.randomUUID().toString() : incoming;
        ServerHttpRequest request = exchange.getRequest().mutate().header(HEADER, id).build();
        exchange.getResponse().getHeaders().set(HEADER, id);
        long start = System.nanoTime();
        return chain.filter(exchange.mutate().request(request).build()).doFinally(sig -> {
            if (!request.getPath().value().startsWith("/actuator")) {
                log.info("correlationId={} {} {} -> {} ({} ms)", id, request.getMethod(), request.getPath().value(),
                        exchange.getResponse().getStatusCode() == null ? "?" : exchange.getResponse().getStatusCode().value(),
                        (System.nanoTime() - start) / 1_000_000);
            }
        });
    }

    @Override
    public int getOrder() { return Ordered.HIGHEST_PRECEDENCE; }
}
