package com.hrportal.common.cache;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.exception.ServiceUnavailableException;

/**
 * Redis distributed lock (SET key token NX PX ttl, released with a compare-and-delete Lua script so a lock can
 * never be released by a process that no longer owns it). Used to serialise per-employee workflows that span
 * several service instances (leave applications, payroll runs, check-ins).
 */
@Service
public class DistributedLockService {
    private static final Logger log = LoggerFactory.getLogger(DistributedLockService.class);
    private static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", Long.class);
    private final StringRedisTemplate redis;

    public DistributedLockService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public <T> T withLock(String name, Duration ttl, Supplier<T> action) {
        String key = "hr:lock:" + name;
        String token = UUID.randomUUID().toString();
        Boolean acquired;
        try {
            acquired = redis.opsForValue().setIfAbsent(key, token, ttl);
        } catch (Exception e) {
            throw new ServiceUnavailableException("Lock service unavailable");
        }
        if (!Boolean.TRUE.equals(acquired)) {
            throw new ConflictException("Another operation for '" + name + "' is already in progress - retry shortly");
        }
        try {
            return action.get();
        } finally {
            try {
                redis.execute(RELEASE, List.of(key), token);
            } catch (Exception e) {
                log.warn("Could not release lock {}: {}", key, e.toString());
            }
        }
    }

    public void withLock(String name, Duration ttl, Runnable action) {
        withLock(name, ttl, () -> {
            action.run();
            return null;
        });
    }
}
