package com.hrportal.gateway;

import java.security.Principal;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import reactor.core.publisher.Mono;

@Configuration
public class GatewayBeans {

    /** Rate-limit key: the authenticated user (JWT subject), otherwise the client IP (so anonymous login attempts are limited per address). */
    @Bean
    public KeyResolver userOrIpKeyResolver() {
        return exchange -> exchange.getPrincipal().map(Principal::getName)
                .switchIfEmpty(Mono.fromSupplier(() -> exchange.getRequest().getRemoteAddress() == null ? "anonymous" : exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()));
    }

    @RestController
    public static class PingController {
        @GetMapping("/ping")
        public java.util.Map<String, Object> ping() {
            return java.util.Map.of("service", "hr-api-gateway", "status", "UP", "time", java.time.Instant.now().toString());
        }
    }
}
