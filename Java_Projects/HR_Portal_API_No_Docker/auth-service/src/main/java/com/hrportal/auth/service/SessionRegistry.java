package com.hrportal.auth.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.hrportal.common.security.TokenRevocationChecker;

/**
 * Redis SORTED SET per user (hr:auth:sessions:&lt;userId&gt;): member = access-token id (jti), score = its expiry epoch.
 * That lets an administrator (or a password change) invalidate every live access token of a user at once:
 * all members that have not yet expired are written to the revocation keys the other services check.
 */
@Service
public class SessionRegistry {
    private static final Logger log = LoggerFactory.getLogger(SessionRegistry.class);
    private final StringRedisTemplate redis;

    public SessionRegistry(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private static String key(String userId) {
        return "hr:auth:sessions:" + userId;
    }

    public void register(String userId, String jti, Instant expiresAt) {
        try {
            redis.opsForZSet().add(key(userId), jti, expiresAt.getEpochSecond());
            redis.opsForZSet().removeRangeByScore(key(userId), 0, Instant.now().getEpochSecond());
            redis.expire(key(userId), Duration.ofDays(1));
        } catch (Exception e) {
            log.warn("Session registry unavailable: {}", e.toString());
        }
    }

    public void revokeToken(String jti, Instant expiresAt) {
        if (jti == null) return;
        long seconds = Math.max(1, Duration.between(Instant.now(), expiresAt).getSeconds());
        redis.opsForValue().set(TokenRevocationChecker.PREFIX + jti, "1", Duration.ofSeconds(seconds));
    }

    /** Revokes every non-expired access token of the user; returns how many were revoked. */
    public int revokeAll(String userId) {
        long now = Instant.now().getEpochSecond();
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> live =
                redis.opsForZSet().rangeByScoreWithScores(key(userId), now, Double.POSITIVE_INFINITY);
        int n = 0;
        if (live != null) {
            for (var t : live) {
                if (t.getValue() == null || t.getScore() == null) continue;
                revokeToken(t.getValue(), Instant.ofEpochSecond(t.getScore().longValue()));
                n++;
            }
        }
        redis.delete(key(userId));
        return n;
    }

    public void remove(String userId, String jti) {
        try {
            redis.opsForZSet().remove(key(userId), jti);
        } catch (Exception e) {
            log.warn("Session registry unavailable: {}", e.toString());
        }
    }
}
