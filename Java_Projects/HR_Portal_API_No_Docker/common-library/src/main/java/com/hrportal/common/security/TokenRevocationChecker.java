package com.hrportal.common.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Logout writes the token id (jti) to Redis with a TTL equal to the token's remaining life; every service
 * rejects revoked tokens. If Redis is unreachable we fail OPEN (log + allow) so a cache outage does not take
 * the whole portal down - the access-token lifetime is short for exactly that reason.
 */
@Component
public class TokenRevocationChecker {
    private static final Logger log = LoggerFactory.getLogger(TokenRevocationChecker.class);
    public static final String PREFIX = "hr:auth:revoked:";
    private final StringRedisTemplate redis;

    public TokenRevocationChecker(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public boolean isRevoked(String jti) {
        if (jti == null) return false;
        try {
            return Boolean.TRUE.equals(redis.hasKey(PREFIX + jti));
        } catch (Exception e) {
            log.warn("Revocation check skipped, Redis unavailable: {}", e.toString());
            return false;
        }
    }
}
