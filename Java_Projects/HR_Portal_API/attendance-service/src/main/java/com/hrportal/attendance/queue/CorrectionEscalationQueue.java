package com.hrportal.attendance.queue;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.DelayQueue;
import java.util.concurrent.Delayed;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.hrportal.attendance.service.CorrectionService;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * DelayQueue of correction requests: each request becomes available for "escalation" after the configured wait.
 * A single daemon worker blocks on {@code take()} and hands due items to the service, which escalates a request that is
 * still PENDING. The queue is in memory, so the service re-registers the pending requests at start-up.
 */
@Component
public class CorrectionEscalationQueue {
    private static final Logger log = LoggerFactory.getLogger(CorrectionEscalationQueue.class);

    public record Task(String correctionId, Instant dueAt) implements Delayed {
        @Override
        public long getDelay(TimeUnit unit) {
            return unit.convert(Duration.between(Instant.now(), dueAt).toMillis(), TimeUnit.MILLISECONDS);
        }

        @Override
        public int compareTo(Delayed o) {
            return Long.compare(getDelay(TimeUnit.MILLISECONDS), o.getDelay(TimeUnit.MILLISECONDS));
        }
    }

    private final DelayQueue<Task> queue = new DelayQueue<>();
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "correction-escalation");
        t.setDaemon(true);
        return t;
    });
    private final CorrectionService corrections;
    private final Duration wait;
    private volatile boolean running = true;

    public CorrectionEscalationQueue(@org.springframework.context.annotation.Lazy CorrectionService corrections,
                                     @Value("${hr.attendance.escalation-hours:48}") long hours) {
        this.corrections = corrections;
        this.wait = Duration.ofHours(hours);
    }

    @PostConstruct
    void start() {
        worker.submit(() -> {
            while (running) {
                try {
                    Task due = queue.poll(2, TimeUnit.SECONDS);       // blocks until the head item is due
                    if (due != null) corrections.escalateIfStillPending(due.correctionId());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (RuntimeException e) {
                    log.warn("Escalation failed: {}", e.toString());
                }
            }
        });
    }

    public void schedule(String correctionId) {
        queue.add(new Task(correctionId, Instant.now().plus(wait)));
    }

    public void scheduleAt(String correctionId, Instant dueAt) {
        queue.add(new Task(correctionId, dueAt.isBefore(Instant.now()) ? Instant.now().plusSeconds(5) : dueAt));
    }

    public int size() {
        return queue.size();
    }

    @PreDestroy
    void stop() {
        running = false;
        worker.shutdownNow();
    }
}
