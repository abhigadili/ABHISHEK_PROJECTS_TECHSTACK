package com.fooddelivery.common.cache;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Cache invalidation that is safe with transactions: the eviction runs AFTER the surrounding database transaction committed.
 * (Evicting before the commit lets a concurrent reader re-fill the cache with the old data, which then stays stale until its TTL.)
 * Also works for calls from inside the same class, where annotation-driven {@code @CacheEvict} is skipped (no Spring proxy).
 */
@Component
public class CacheEvictor {
    private final CacheManager caches;

    public CacheEvictor(CacheManager caches) { this.caches = caches; }

    public void evict(String cache, Object key) { afterCommit(() -> { Cache c = caches.getCache(cache); if (c != null) c.evict(key); }); }

    public void clear(String... names) {
        afterCommit(() -> { for (String n : names) { Cache c = caches.getCache(n); if (c != null) c.clear(); } });
    }

    private void afterCommit(Runnable r) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { try { r.run(); } catch (RuntimeException ignored) { /* cache errors never fail business logic */ } }
            });
        } else {
            try { r.run(); } catch (RuntimeException ignored) { /* same */ }
        }
    }
}
