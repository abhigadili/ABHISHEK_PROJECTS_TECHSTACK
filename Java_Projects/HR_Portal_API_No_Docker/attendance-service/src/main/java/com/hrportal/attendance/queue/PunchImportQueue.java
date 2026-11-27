package com.hrportal.attendance.queue;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import com.hrportal.attendance.entity.Enums.Source;
import com.hrportal.attendance.service.AttendanceService;
import com.hrportal.common.exception.BadRequestException;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * Producer / consumer for bulk punches (biometric device exports): the HTTP request only validates and offers the punches
 * to a bounded {@link LinkedBlockingQueue} (so a huge upload can never exhaust memory - offer fails when full and the
 * caller gets a 400), one worker thread drains the queue and applies each punch in time order per employee.
 */
@Component
public class PunchImportQueue {
    private static final Logger log = LoggerFactory.getLogger(PunchImportQueue.class);

    public record Punch(String employeeId, Instant at) { }

    private final BlockingQueue<Punch> queue;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "punch-import");
        t.setDaemon(true);
        return t;
    });
    private final AttendanceService attendance;
    private volatile boolean running = true;

    public PunchImportQueue(@Lazy AttendanceService attendance, @Value("${hr.attendance.punch-queue-capacity:5000}") int capacity) {
        this.attendance = attendance;
        this.queue = new LinkedBlockingQueue<>(capacity);
    }

    @PostConstruct
    void start() {
        worker.submit(() -> {
            while (running) {
                try {
                    Punch p = queue.poll(1, TimeUnit.SECONDS);
                    if (p != null) apply(p);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        });
    }

    public int offerAll(List<Punch> punches) {
        if (queue.remainingCapacity() < punches.size()) throw new BadRequestException("Import queue is full, retry with a smaller batch");
        punches.stream().sorted(java.util.Comparator.comparing(Punch::at)).forEach(queue::offer);
        return punches.size();
    }

    public int depth() {
        return queue.size();
    }

    /** First punch of a day = check-in, later punches update the check-out. Failures are logged and skipped. */
    private void apply(Punch p) {
        try {
            try {
                attendance.checkIn(p.employeeId(), "OFFICE", p.at(), Source.IMPORT);
            } catch (com.hrportal.common.exception.ConflictException alreadyIn) {
                attendance.checkOut(p.employeeId(), p.at(), Source.IMPORT);
            }
        } catch (RuntimeException e) {
            log.warn("Punch for {} at {} skipped: {}", p.employeeId(), p.at(), e.getMessage());
        }
    }

    @PreDestroy
    void stop() {
        running = false;
        worker.shutdownNow();
    }
}
