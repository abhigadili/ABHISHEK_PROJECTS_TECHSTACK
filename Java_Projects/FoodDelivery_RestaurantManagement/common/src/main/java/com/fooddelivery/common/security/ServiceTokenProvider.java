package com.fooddelivery.common.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** Mints (and caches) the short-lived token a service uses when no end-user token is available (Kafka consumers, schedulers). */
@Component
public class ServiceTokenProvider {
    private final JwtService jwt;
    private final String serviceName;
    private volatile String token;
    private volatile Instant expiresAt = Instant.EPOCH;

    public ServiceTokenProvider(JwtService jwt, @Value("${spring.application.name}") String serviceName) {
        this.jwt = jwt;
        this.serviceName = serviceName;
    }

    public synchronized String token() {
        if (token == null || Instant.now().isAfter(expiresAt.minusSeconds(30))) {
            token = jwt.issueServiceToken(serviceName, 300);
            expiresAt = Instant.now().plusSeconds(300);
        }
        return token;
    }
}
