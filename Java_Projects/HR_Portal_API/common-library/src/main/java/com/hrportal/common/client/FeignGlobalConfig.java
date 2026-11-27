package com.hrportal.common.client;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.exception.BadRequestException;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.DownstreamClientException;
import com.hrportal.common.exception.ForbiddenOperationException;
import com.hrportal.common.exception.ResourceNotFoundException;
import com.hrportal.common.exception.ServiceUnavailableException;
import com.hrportal.common.exception.UnauthorizedException;
import com.hrportal.common.security.CurrentUser;

import feign.FeignException;
import feign.RequestInterceptor;
import feign.Response;
import feign.RetryableException;
import feign.Retryer;
import feign.codec.ErrorDecoder;

/**
 * Applies to every OpenFeign client in the service:
 * - header propagation: the caller's Authorization header and the correlation id travel downstream,
 * - ErrorDecoder: a downstream 404/400/409... becomes the same exception type locally (and is not retried),
 * - Retryer: only I/O failures (connection reset / refused) are retried, 3 attempts with back-off. The Feign
 *   clients in this project are idempotent reads, so a retry can never duplicate a business action.
 */
@Configuration
public class FeignGlobalConfig {
    private static final Logger log = LoggerFactory.getLogger(FeignGlobalConfig.class);

    @Bean
    public RequestInterceptor hrHeaderPropagationInterceptor() {
        return template -> {
            String token = CurrentUser.token();
            if (token != null) template.header("Authorization", "Bearer " + token);
            String cid = MDC.get("correlationId");
            if (cid != null) template.header("X-Correlation-Id", cid);
            log.debug("Feign -> {} {}", template.method(), template.url());
        };
    }

    @Bean
    public ErrorDecoder hrErrorDecoder(ObjectMapper mapper) {
        return (methodKey, response) -> {
            HttpStatus status = HttpStatus.resolve(response.status());
            String message = extractMessage(mapper, response);
            log.info("Feign {} answered {} {}", methodKey, response.status(), message);
            if (status == null) return new ServiceUnavailableException("Downstream error " + response.status());
            return switch (status) {
                case NOT_FOUND -> new ResourceNotFoundException(message);
                case BAD_REQUEST, UNPROCESSABLE_ENTITY -> new BadRequestException(message);
                case CONFLICT -> new ConflictException(message);
                case UNAUTHORIZED -> new UnauthorizedException(message);
                case FORBIDDEN -> new ForbiddenOperationException(message);
                default -> status.is4xxClientError() ? new DownstreamClientException(status, message)
                        : retryOrUnavailable(response, methodKey);
            };
        };
    }

    private RuntimeException retryOrUnavailable(Response response, String methodKey) {
        if (response.status() == 503 || response.status() == 502 || response.status() == 504) {
            return new RetryableException(response.status(), "Downstream unavailable (" + methodKey + ")",
                    response.request().httpMethod(), (Long) null, response.request());
        }
        return new ServiceUnavailableException("Downstream service error (" + response.status() + ")");
    }

    private String extractMessage(ObjectMapper mapper, Response response) {
        try {
            if (response.body() == null) return "Downstream returned " + response.status();
            String body = new String(response.body().asInputStream().readAllBytes(), StandardCharsets.UTF_8);
            JsonNode n = mapper.readTree(body);
            return n.hasNonNull("message") ? n.get("message").asText() : "Downstream returned " + response.status();
        } catch (IOException e) {
            return "Downstream returned " + response.status();
        }
    }

    @Bean
    public Retryer hrRetryer() {
        return new Retryer.Default(200, 1000, 3);
    }

    /** Turns exhausted Feign I/O failures into our 503 type (used by callers that catch FeignException). */
    public static RuntimeException translate(FeignException e) {
        return new ServiceUnavailableException("Downstream service unavailable: " + e.status());
    }
}
