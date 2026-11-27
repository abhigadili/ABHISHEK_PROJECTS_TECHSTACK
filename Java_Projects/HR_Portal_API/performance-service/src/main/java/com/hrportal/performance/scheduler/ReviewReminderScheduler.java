package com.hrportal.performance.scheduler;

import java.time.Duration;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.common.cache.DistributedLockService;
import com.hrportal.performance.entity.Enums.CycleStatus;
import com.hrportal.performance.entity.Enums.ReviewStatus;
import com.hrportal.performance.producer.PerformanceEventProducer;
import com.hrportal.performance.repository.PerformanceRepositories.CycleRepository;
import com.hrportal.performance.repository.PerformanceRepositories.ReviewRepository;

/** Daily 05:00 UTC: reminds employees (self stage) and managers (manager stage) of reviews whose deadline is within 3 days or has passed. One reminder per review per day (dedup key). */
@Component
public class ReviewReminderScheduler {
    private static final Logger log = LoggerFactory.getLogger(ReviewReminderScheduler.class);
    private final CycleRepository cycles;
    private final ReviewRepository reviews;
    private final PerformanceEventProducer producer;
    private final DistributedLockService locks;
    private final TransactionTemplate tx;

    public ReviewReminderScheduler(CycleRepository cycles, ReviewRepository reviews, PerformanceEventProducer producer, DistributedLockService locks, TransactionTemplate tx) {
        this.cycles = cycles;
        this.reviews = reviews;
        this.producer = producer;
        this.locks = locks;
        this.tx = tx;
    }

    @Scheduled(cron = "0 0 5 * * *", zone = "UTC")
    public void remind() {
        try {
            int n = locks.withLock("review-reminders", Duration.ofMinutes(5), () -> tx.execute(s -> run()));
            log.info("Review reminders queued: {}", n);
        } catch (RuntimeException e) {
            log.warn("Review reminder job skipped: {}", e.getMessage());
        }
    }

    public int run() {
        LocalDate today = LocalDate.now();
        int[] sent = {0};
        cycles.findByStatus(CycleStatus.ACTIVE).forEach(c -> reviews.findByCycleId(c.getId()).forEach(r -> {
            if (r.getStatus() == ReviewStatus.SELF_PENDING && !today.plusDays(3).isBefore(c.getSelfEvalDeadline())) {
                producer.notify(r.getEmployeeId(), "REVIEW_REMINDER", r, "Self evaluation due " + c.getSelfEvalDeadline(), "review-rem:" + r.getId() + ":" + today);
                sent[0]++;
            } else if (r.getStatus() == ReviewStatus.SELF_SUBMITTED && r.getManagerId() != null && !today.plusDays(3).isBefore(c.getManagerEvalDeadline())) {
                producer.notify(r.getManagerId(), "REVIEW_REMINDER", r, "Manager evaluation due " + c.getManagerEvalDeadline(), "review-rem-m:" + r.getId() + ":" + today);
                sent[0]++;
            }
        }));
        return sent[0];
    }
}
