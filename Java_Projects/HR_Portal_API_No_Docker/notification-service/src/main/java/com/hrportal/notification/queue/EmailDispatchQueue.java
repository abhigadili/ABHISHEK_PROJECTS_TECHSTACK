package com.hrportal.notification.queue;

import java.time.Instant;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.notification.entity.Enums.DeliveryStatus;
import com.hrportal.notification.repository.NotificationRepositories.NotificationRepository;
import com.hrportal.notification.service.EmailSender;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * Producer / consumer for outgoing e-mail: the Kafka listener thread only offers a job to a bounded {@link ArrayBlockingQueue} (so a slow
 * mail server cannot stall event consumption); a small pool of workers take()s jobs, sends and records SENT / FAILED. When the queue is full
 * the notification simply stays PENDING and is picked up later by the retry job.
 */
@Component
public class EmailDispatchQueue {
    private static final Logger log = LoggerFactory.getLogger(EmailDispatchQueue.class);

    /** The delivery body lives only in memory - the stored body has sensitive tokens masked. */
    public record Job(String notificationId, String to, String subject, String deliveryBody) { }

    private final BlockingQueue<Job> queue;
    private final ExecutorService workers;
    private final EmailSender sender;
    private final NotificationRepository notifications;
    private final TransactionTemplate tx;
    private volatile boolean running = true;
    private final int workerCount;

    public EmailDispatchQueue(EmailSender sender, NotificationRepository notifications, TransactionTemplate tx,
                              @Value("${hr.notification.email-queue-capacity:500}") int capacity, @Value("${hr.notification.email-workers:2}") int workerCount) {
        this.sender = sender;
        this.notifications = notifications;
        this.tx = tx;
        this.queue = new ArrayBlockingQueue<>(capacity);
        this.workerCount = workerCount;
        this.workers = Executors.newFixedThreadPool(workerCount, r -> {
            Thread t = new Thread(r, "email-dispatch");
            t.setDaemon(true);
            return t;
        });
    }

    @PostConstruct
    void start() {
        for (int i = 0; i < workerCount; i++) {
            workers.submit(() -> {
                while (running) {
                    try {
                        Job job = queue.poll(1, TimeUnit.SECONDS);
                        if (job != null) deliver(job);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            });
        }
    }

    /** @return false when the queue is full (the notification stays PENDING) */
    public boolean offer(Job job) {
        boolean ok = queue.offer(job);
        if (!ok) log.warn("E-mail queue full - notification {} stays PENDING", job.notificationId());
        return ok;
    }

    public int depth() {
        return queue.size();
    }

    private void deliver(Job job) {
        DeliveryStatus status;
        String error = null;
        try {
            sender.send(job.to(), job.subject(), job.deliveryBody());
            status = DeliveryStatus.SENT;
        } catch (RuntimeException e) {
            status = DeliveryStatus.FAILED;
            error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            log.warn("E-mail for notification {} failed: {}", job.notificationId(), error);
        }
        final DeliveryStatus finalStatus = status;
        final String finalError = error == null ? null : error.substring(0, Math.min(error.length(), 190));
        tx.executeWithoutResult(s -> notifications.findById(job.notificationId()).ifPresent(n -> {
            n.setStatus(finalStatus);
            n.setSentAt(finalStatus == DeliveryStatus.SENT ? Instant.now() : null);
            n.setErrorMessage(finalError);
            notifications.save(n);
        }));
    }

    @PreDestroy
    void stop() {
        running = false;
        workers.shutdownNow();
    }
}
