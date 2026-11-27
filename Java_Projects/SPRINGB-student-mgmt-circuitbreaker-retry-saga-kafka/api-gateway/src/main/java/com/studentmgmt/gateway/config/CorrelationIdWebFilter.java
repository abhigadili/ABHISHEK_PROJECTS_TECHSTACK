package com.studentmgmt.gateway.config;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.util.context.Context;

import java.util.UUID;

/**
 * The gateway is the single entry point, so it's the natural place to MINT a
 * correlation id for every request that doesn't already carry one, then
 * forward it downstream as a plain header. Every backend service's own
 * CorrelationIdFilter just reads this header and puts it in its own SLF4J
 * MDC — the net effect is that one client request produces log lines in up
 * to four different services (gateway, student/course-service via Kafka,
 * enrollment-service, notification-service) that all share the same
 * correlation id, so `grep <id> logs/*.log` reconstructs the entire journey
 * without needing a dedicated tracing tool like Zipkin.
 *
 * Implemented as a WebFilter (not a GlobalFilter) so it also covers the
 * locally-handled /auth/login endpoint, not just proxied routes.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdWebFilter implements WebFilter {

    public static final String HEADER_NAME = "X-Correlation-Id";
    public static final String MDC_KEY = "correlationId";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String correlationId = request.getHeaders().getFirst(HEADER_NAME);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        String finalCorrelationId = correlationId;

        ServerHttpRequest mutatedRequest = request.mutate()
                .header(HEADER_NAME, finalCorrelationId)
                .build();
        exchange.getResponse().getHeaders().add(HEADER_NAME, finalCorrelationId);

        return chain.filter(exchange.mutate().request(mutatedRequest).build())
                .contextWrite(Context.of(MDC_KEY, finalCorrelationId))
                .doOnEach(signal -> {
                    if (signal.isOnNext() || signal.isOnError()) {
                        MDC.put(MDC_KEY, finalCorrelationId);
                    }
                })
                .doFinally(signalType -> MDC.remove(MDC_KEY));
    }
}
