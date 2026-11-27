package com.example.enrollment.client;

import com.example.common.security.JwtTokenService;
import feign.RequestInterceptor;
import feign.codec.ErrorDecoder;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;

/** Not annotated @Configuration on purpose: picked up per Feign client via @FeignClient(configuration=...). */
public class FeignConfig {

    /** Service-to-service authentication: short-lived JWT with role SERVICE, plus correlation-id propagation. */
    @Bean
    RequestInterceptor serviceAuthInterceptor(JwtTokenService tokens) {
        return template -> {
            template.header("Authorization", "Bearer " + tokens.createServiceToken("enrollment-service"));
            String cid = MDC.get("correlationId");
            if (cid != null) template.header("X-Correlation-Id", cid);
        };
    }

    @Bean
    ErrorDecoder remoteErrorDecoder() {
        return (methodKey, response) -> {
            String msg = methodKey + " -> HTTP " + response.status();
            return switch (response.status()) {
                case 404 -> new RemoteExceptions.RemoteNotFoundException(msg);
                case 409 -> new RemoteExceptions.RemoteConflictException(msg);
                case 400, 401, 403, 422 -> new RemoteExceptions.RemoteRejectedException(msg);
                default -> new RemoteExceptions.RemoteUnavailableException(msg);
            };
        };
    }
}
