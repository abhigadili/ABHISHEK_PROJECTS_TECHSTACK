package com.hrportal.leave.scheduler;

import java.time.Duration;
import java.time.YearMonth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.hrportal.common.cache.DistributedLockService;
import com.hrportal.leave.service.LeaveBalanceService;

/** Monthly accrual on the 1st at 00:15 UTC. The Redis lock + the run-log key make it safe with several service instances. */
@Component
public class LeaveScheduler {
    private static final Logger log = LoggerFactory.getLogger(LeaveScheduler.class);
    private final LeaveBalanceService balances;
    private final DistributedLockService locks;

    public LeaveScheduler(LeaveBalanceService balances, DistributedLockService locks) {
        this.balances = balances;
        this.locks = locks;
    }

    @Scheduled(cron = "0 15 0 1 * *", zone = "UTC")
    public void monthlyAccrual() {
        try {
            locks.withLock("leave-accrual", Duration.ofMinutes(10), () -> balances.accrueMonth(YearMonth.now()));
        } catch (RuntimeException e) {
            log.warn("Scheduled leave accrual skipped: {}", e.getMessage());
        }
    }
}
