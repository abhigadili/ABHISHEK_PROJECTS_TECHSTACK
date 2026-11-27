package com.fooddelivery.common.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** Redis-backed deny-list of token ids (logout). Fails open if Redis is down so authentication stays available. */
@Component
public class RevokedTokenStore {
    private static final Logger log = LoggerFactory.getLogger(RevokedTokenStore.class);
    private static final String PREFIX = "jwt:revoked:";
    private final StringRedisTemplate redis;

    public RevokedTokenStore(StringRedisTemplate redis) { this.redis = redis; }

    public void revoke(String tokenId, Duration ttl) {
        try { redis.opsForValue().set(PREFIX + tokenId, "1", ttl); }
        catch (Exception e) { log.warn("Could not record revoked token (Redis unavailable): {}", e.getMessage()); }
    }

    public boolean isRevoked(String tokenId) {
        try { return Boolean.TRUE.equals(redis.hasKey(PREFIX + tokenId)); }
        catch (Exception e) { log.warn("Revocation check skipped (Redis unavailable): {}", e.getMessage()); return false; }
    }
}
