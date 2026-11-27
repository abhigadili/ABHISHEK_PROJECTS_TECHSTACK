package com.example.course.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Evicts course caches AFTER the surrounding transaction commits. Evicting before commit would let a concurrent
 * reader re-populate the cache with the old row.
 */
@Component
public class CourseCacheEvictor {
    public static final String COURSES = "courses";
    public static final String AVAILABILITY = "courseAvailability";
    private static final Logger log = LoggerFactory.getLogger(CourseCacheEvictor.class);

    private final CacheManager cacheManager;

    public CourseCacheEvictor(CacheManager cacheManager) { this.cacheManager = cacheManager; }

    public void evictAfterCommit(Long courseId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { evictNow(courseId); }
            });
        } else {
            evictNow(courseId);
        }
    }

    private void evictNow(Long courseId) {
        for (String name : new String[]{COURSES, AVAILABILITY}) {
            try {
                Cache c = cacheManager.getCache(name);
                if (c != null) c.evict(courseId);
            } catch (RuntimeException e) {
                log.warn("Cache evict failed [{}:{}]: {}", name, courseId, e.getMessage());
            }
        }
    }
}
