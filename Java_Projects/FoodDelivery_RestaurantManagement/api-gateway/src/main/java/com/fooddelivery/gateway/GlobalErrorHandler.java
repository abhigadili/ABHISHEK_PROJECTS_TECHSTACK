package com.fooddelivery.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

/** Global exception handling: every gateway-level failure is returned as the platform's JSON error shape. */
@Component
@Order(-2)
public class GlobalErrorHandler implements WebExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalErrorHandler.class);

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        if (exchange.getResponse().isCommitted()) return Mono.error(ex);
        HttpStatusCode status = ex instanceof ResponseStatusException r ? r.getStatusCode() : HttpStatus.INTERNAL_SERVER_ERROR;
        if (status.value() == 503 || status.value() == 504) log.warn("Gateway upstream problem: {}", ex.getMessage());
        else if (status.is5xxServerError()) log.error("Gateway error", ex);
        var res = exchange.getResponse();
        res.setStatusCode(status);
        res.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String msg = status.value() == 503 ? "No healthy instance of the target service is available"
                : status.value() == 404 ? "No such route" : status.is5xxServerError() ? "Gateway error" : "Request failed";
        String body = "{\"timestamp\":\"" + Instant.now() + "\",\"status\":" + status.value() + ",\"code\":\"GATEWAY_ERROR\",\"message\":\""
                + msg + "\",\"path\":\"" + exchange.getRequest().getURI().getPath() + "\"}";
        DataBuffer buf = res.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return res.writeWith(Mono.just(buf));
    }
}
