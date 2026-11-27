package com.fooddelivery.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Request filter + response filter in one: creates/propagates the correlation id to downstream services, adds it
 * (and X-Gateway) to the response, and writes the structured access-log line when the response completes.
 */
@Component
public class CorrelationAndLoggingFilter implements GlobalFilter, Ordered {
    private static final Logger ACCESS = LoggerFactory.getLogger("access");
    public static final String HEADER = "X-Correlation-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String cid = exchange.getRequest().getHeaders().getFirst(HEADER);
        if (cid == null || cid.isBlank()) cid = UUID.randomUUID().toString();
        final String correlationId = cid;
        var mutated = exchange.mutate().request(r -> r.header(HEADER, correlationId)).build();
        mutated.getResponse().getHeaders().set(HEADER, correlationId);
        mutated.getResponse().getHeaders().set("X-Gateway", "food-api-gateway");
        long start = System.nanoTime();
        return chain.filter(mutated).doFinally(sig -> {
            long ms = (System.nanoTime() - start) / 1_000_000;
            var status = mutated.getResponse().getStatusCode();
            MDC.put("correlationId", correlationId);
            MDC.put("httpMethod", mutated.getRequest().getMethod().name());
            MDC.put("httpPath", mutated.getRequest().getURI().getPath());
            MDC.put("httpStatus", String.valueOf(status == null ? 0 : status.value()));
            MDC.put("durationMs", String.valueOf(ms));
            try {
                ACCESS.info("{} {} -> {} ({} ms)", mutated.getRequest().getMethod(), mutated.getRequest().getURI().getPath(),
                        status == null ? 0 : status.value(), ms);
            } finally {
                MDC.clear();
            }
        });
    }

    @Override
    public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 1; }
}
