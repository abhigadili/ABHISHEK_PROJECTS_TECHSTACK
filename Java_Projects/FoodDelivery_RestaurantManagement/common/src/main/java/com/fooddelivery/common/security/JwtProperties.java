package com.fooddelivery.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/** Bound from {@code food.jwt.*}. The secret comes from the JWT_SECRET environment variable. */
@ConfigurationProperties(prefix = "food.jwt")
public record JwtProperties(String secret, String issuer, Duration accessTtl, Duration refreshTtl) {
    public JwtProperties {
        if (issuer == null) issuer = "food-delivery";
        if (accessTtl == null) accessTtl = Duration.ofMinutes(30);
        if (refreshTtl == null) refreshTtl = Duration.ofDays(7);
    }
}
