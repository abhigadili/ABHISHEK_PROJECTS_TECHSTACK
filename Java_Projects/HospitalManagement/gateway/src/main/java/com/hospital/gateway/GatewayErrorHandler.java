package com.hospital.gateway;

import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.log4j.Log4j2;
import reactor.core.publisher.Mono;

/** Gateway-level error handling: unreachable/slow services become clean 503/504 JSON instead of stack traces. */
@Log4j2
@Component
@Order(-2)
public class GatewayErrorHandler implements ErrorWebExceptionHandler {
    private final ObjectMapper mapper;

    public GatewayErrorHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        if (exchange.getResponse().isCommitted()) return Mono.error(ex);
        HttpStatus status;
        String message;
        if (ex instanceof ResponseStatusException rse) {
            status = HttpStatus.valueOf(rse.getStatusCode().value());
            message = status == HttpStatus.NOT_FOUND ? "No such route or endpoint" : rse.getReason() != null ? rse.getReason() : status.getReasonPhrase();
        } else if (hasCause(ex, "ConnectException") || hasCause(ex, "UnknownHostException")) {
            status = HttpStatus.SERVICE_UNAVAILABLE;
            message = "The target service is currently unavailable";
        } else if (hasCause(ex, "TimeoutException")) {
            status = HttpStatus.GATEWAY_TIMEOUT;
            message = "The target service did not respond in time";
        } else {
            status = HttpStatus.BAD_GATEWAY;
            message = "Gateway error while contacting the target service";
        }
        if (status.is5xxServerError()) {
            log.warn("{} {} -> {} ({})", exchange.getRequest().getMethod(), exchange.getRequest().getPath(), status.value(), ex.toString());
        }
        return GatewaySecurityConfig.write(mapper, exchange, status, message);
    }

    private static boolean hasCause(Throwable t, String simpleName) {
        for (Throwable c = t; c != null; c = c.getCause() == c ? null : c.getCause()) {
            if (c.getClass().getSimpleName().contains(simpleName)) return true;
        }
        return false;
    }
}
