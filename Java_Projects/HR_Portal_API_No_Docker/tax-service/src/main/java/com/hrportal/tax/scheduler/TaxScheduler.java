package com.hrportal.tax.scheduler;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.hrportal.common.cache.DistributedLockService;
import com.hrportal.tax.service.TaxSupportService;

/** Weekly reminder (Mondays 04:30 UTC); the Redis lock prevents duplicate runs across instances and the notification dedup key prevents duplicate messages. */
@Component
public class TaxScheduler {
    private static final Logger log = LoggerFactory.getLogger(TaxScheduler.class);
    private final TaxSupportService support;
    private final DistributedLockService locks;

    public TaxScheduler(TaxSupportService support, DistributedLockService locks) {
        this.support = support;
        this.locks = locks;
    }

    @Scheduled(cron = "0 30 4 * * MON", zone = "UTC")
    public void weeklyReminders() {
        try {
            locks.withLock("tax-reminders", Duration.ofMinutes(5), support::sendReminders);
        } catch (RuntimeException e) {
            log.warn("Tax reminder job skipped: {}", e.getMessage());
        }
    }
}
