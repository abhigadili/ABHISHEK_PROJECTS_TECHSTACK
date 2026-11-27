package com.hospital.appointment.service;

import java.time.LocalDate;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import lombok.extern.log4j.Log4j2;

/** Evicts cache entries AFTER the DB transaction commits, so a concurrent reader can never re-cache stale data. */
@Log4j2
@Component
public class CacheEvictor {
    public static final String APPOINTMENTS = "appointments";
    public static final String AVAILABILITY = "appointmentAvailability";

    private final CacheManager cacheManager;

    public CacheEvictor(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    public void appointment(Long id) {
        afterCommit(() -> evict(APPOINTMENTS, id));
    }

    public void availability(Long doctorId, LocalDate date) {
        afterCommit(() -> evict(AVAILABILITY, doctorId + ":" + date));
    }

    private void evict(String cacheName, Object key) {
        try {
            Cache c = cacheManager.getCache(cacheName);
            if (c != null) c.evict(key);
        } catch (RuntimeException e) {
            log.warn("Cache eviction failed ({} / {}): {}", cacheName, key, e.toString());
        }
    }

    private static void afterCommit(Runnable r) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    r.run();
                }
            });
        } else {
            r.run();
        }
    }
}
