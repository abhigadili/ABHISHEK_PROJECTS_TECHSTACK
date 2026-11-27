package com.hrportal.attendance.scheduler;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.hrportal.attendance.service.AttendanceService;
import com.hrportal.common.cache.DistributedLockService;

/** Nightly missing-punch detection (01:00 UTC); the Redis lock keeps multiple instances from running it twice. */
@Component
public class AttendanceScheduler {
    private static final Logger log = LoggerFactory.getLogger(AttendanceScheduler.class);
    private final AttendanceService attendance;
    private final DistributedLockService locks;

    public AttendanceScheduler(AttendanceService attendance, DistributedLockService locks) {
        this.attendance = attendance;
        this.locks = locks;
    }

    @Scheduled(cron = "0 0 1 * * *", zone = "UTC")
    public void flagMissingPunches() {
        try {
            int n = locks.withLock("attendance-missing-punch", Duration.ofMinutes(5), attendance::flagMissingPunches);
            log.info("Missing-punch job flagged {} record(s)", n);
        } catch (RuntimeException e) {
            log.warn("Missing-punch job skipped: {}", e.getMessage());
        }
    }
}
