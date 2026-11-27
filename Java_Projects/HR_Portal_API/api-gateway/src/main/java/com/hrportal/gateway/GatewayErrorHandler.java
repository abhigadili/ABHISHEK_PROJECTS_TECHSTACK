package com.hrportal.gateway;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.security.web.server.authorization.ServerAccessDeniedHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import reactor.core.publisher.Mono;

/** One JSON error shape for everything the gateway itself answers (401, 403, 404, 429, 502 / 503 ...) - same fields as the services' ApiError. */
@Component
@Order(-2)
public class GatewayErrorHandler implements ErrorWebExceptionHandler, ServerAuthenticationEntryPoint, ServerAccessDeniedHandler {
    private static final Logger log = LoggerFactory.getLogger(GatewayErrorHandler.class);
    private final ObjectMapper mapper;

    public GatewayErrorHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public Mono<Void> commence(ServerWebExchange exchange, AuthenticationException ex) {
        return write(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required: missing, invalid, revoked or expired token");
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, AccessDeniedException denied) {
        return write(exchange, HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to perform this action");
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        if (exchange.getResponse().isCommitted()) return Mono.error(ex);
        if (ex instanceof ResponseStatusException rse) {
            HttpStatusCode status = rse.getStatusCode();
            HttpStatus resolved = HttpStatus.resolve(status.value());
            String code = status.value() == 404 ? "ROUTE_NOT_FOUND" : status.value() == 429 ? "RATE_LIMITED" : status.value() == 503 ? "SERVICE_UNAVAILABLE" : "GATEWAY_ERROR";
            String message = status.value() == 404 ? "No such endpoint" : status.value() == 503 ? "The target service is unavailable" : resolved == null ? "Gateway error" : resolved.getReasonPhrase();
            return write(exchange, status, code, message);
        }
        if (ex instanceof java.net.ConnectException || (ex.getCause() instanceof java.net.ConnectException) || ex.getClass().getSimpleName().contains("Connect")) {
            return write(exchange, HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "The target service is unavailable");
        }
        log.error("Unhandled gateway error on {}", exchange.getRequest().getPath(), ex);
        return write(exchange, HttpStatus.INTERNAL_SERVER_ERROR, "GATEWAY_ERROR", "Unexpected gateway error");
    }

    private Mono<Void> write(ServerWebExchange exchange, HttpStatusCode status, String code, String message) {
        HttpStatus resolved = HttpStatus.resolve(status.value());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", resolved == null ? "Error" : resolved.getReasonPhrase());
        body.put("code", code);
        body.put("message", message);
        body.put("path", exchange.getRequest().getPath().value());
        String cid = exchange.getResponse().getHeaders().getFirst(CorrelationIdFilter.HEADER);
        if (cid != null) body.put("correlationId", cid);
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        try {
            DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(mapper.writeValueAsString(body).getBytes(StandardCharsets.UTF_8));
            return exchange.getResponse().writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            return exchange.getResponse().setComplete();
        }
    }
}
