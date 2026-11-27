package com.hrportal.common.cache;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

/** Programmatic cache invalidation used by services after writes and by Kafka consumers (never throws on Redis errors). */
@Component
public class CacheEvictor {
    private static final Logger log = LoggerFactory.getLogger(CacheEvictor.class);
    private final CacheManager manager;

    public CacheEvictor(CacheManager manager) {
        this.manager = manager;
    }

    public void evict(String cacheName, Object key) {
        try {
            Cache c = manager.getCache(cacheName);
            if (c != null) c.evict(key);
        } catch (Exception e) {
            log.warn("Cache evict failed {}/{}: {}", cacheName, key, e.toString());
        }
    }

    public void clear(String... cacheNames) {
        for (String n : cacheNames) {
            try {
                Cache c = manager.getCache(n);
                if (c != null) c.clear();
            } catch (Exception e) {
                log.warn("Cache clear failed {}: {}", n, e.toString());
            }
        }
    }
}
