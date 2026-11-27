package com.hrportal.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

/** GLOBAL FILTER #2 (request logging): method, path, target route, status and duration with the correlation id. Query strings and bodies are never logged. */
@Component
public class RequestLoggingFilter implements GlobalFilter, Ordered {
    private static final Logger log = LoggerFactory.getLogger("gateway.access");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long start = System.nanoTime();
        String cid = exchange.getRequest().getHeaders().getFirst(CorrelationIdFilter.HEADER);
        String method = exchange.getRequest().getMethod().name();
        String path = exchange.getRequest().getPath().value();
        return chain.filter(exchange).doFinally(signal -> {
            Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
            log.info("[cid={}] {} {} -> route={} status={} ({} ms)", cid, method, path, route == null ? "-" : route.getId(),
                    exchange.getResponse().getStatusCode() == null ? "-" : exchange.getResponse().getStatusCode().value(), (System.nanoTime() - start) / 1_000_000);
        });
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
