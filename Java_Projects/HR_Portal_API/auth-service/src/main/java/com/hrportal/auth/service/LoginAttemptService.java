package com.hrportal.auth.service;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Failed-login counter in Redis (INCR + TTL window). After {@code max-attempts} failures inside the window the
 * account is locked by AuthService. Redis keeps the counter cheap and shared by all auth-service instances.
 */
@Service
public class LoginAttemptService {
    private final StringRedisTemplate redis;
    private final int maxAttempts;
    private final Duration window;
    private final Duration lockDuration;

    public LoginAttemptService(StringRedisTemplate redis,
                               @Value("${hr.auth.max-failed-attempts:5}") int maxAttempts,
                               @Value("${hr.auth.attempt-window-minutes:15}") long windowMinutes,
                               @Value("${hr.auth.lock-minutes:15}") long lockMinutes) {
        this.redis = redis;
        this.maxAttempts = maxAttempts;
        this.window = Duration.ofMinutes(windowMinutes);
        this.lockDuration = Duration.ofMinutes(lockMinutes);
    }

    private static String key(String username) {
        return "hr:auth:attempts:" + username.toLowerCase();
    }

    /** @return the number of failures in the current window after recording this one */
    public long recordFailure(String username) {
        Long n = redis.opsForValue().increment(key(username));
        if (n != null && n == 1L) redis.expire(key(username), window);
        return n == null ? 1 : n;
    }

    public void reset(String username) {
        redis.delete(key(username));
    }

    public boolean limitReached(long failures) {
        return failures >= maxAttempts;
    }

    public Duration lockDuration() {
        return lockDuration;
    }
}
