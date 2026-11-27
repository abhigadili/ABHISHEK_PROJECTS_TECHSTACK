package com.example.notification.processing;

import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.repository.NotificationRepository;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Sends one notification in its own transaction; failures schedule an exponential-backoff retry, then FAILED. */
@Component
public class NotificationProcessor {
    private static final Logger log = LoggerFactory.getLogger(NotificationProcessor.class);

    private final NotificationRepository repository;
    private final EmailSimulator email;
    private final int maxAttempts;
    private final long baseBackoffSeconds;

    public NotificationProcessor(NotificationRepository repository, EmailSimulator email,
                                 @Value("${notification.dispatch.max-attempts:5}") int maxAttempts,
                                 @Value("${notification.dispatch.base-backoff-seconds:5}") long baseBackoffSeconds) {
        this.repository = repository; this.email = email; this.maxAttempts = maxAttempts; this.baseBackoffSeconds = baseBackoffSeconds;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void process(Long id) {
        Notification n = repository.findById(id).orElse(null);
        if (n == null || n.getStatus() != NotificationStatus.PENDING) return;
        try {
            email.send(n);
            n.setStatus(NotificationStatus.SENT);
            n.setProcessedAt(LocalDateTime.now());
            n.setLastError(null);
            n.setNextAttemptAt(null);
        } catch (RuntimeException ex) {
            n.setRetryCount(n.getRetryCount() + 1);
            n.setLastError(truncate(ex.getMessage()));
            if (ex instanceof EmailSimulator.NonRetryableNotificationException || n.getRetryCount() >= maxAttempts) {
                n.setStatus(NotificationStatus.FAILED);
                n.setProcessedAt(LocalDateTime.now());
                log.error("Notification {} permanently FAILED after {} attempt(s): {}", id, n.getRetryCount(), ex.getMessage());
            } else {
                long delay = baseBackoffSeconds * (1L << (n.getRetryCount() - 1));
                n.setNextAttemptAt(LocalDateTime.now().plusSeconds(delay));
                log.warn("Notification {} attempt {} failed, retry in {}s: {}", id, n.getRetryCount(), delay, ex.getMessage());
            }
        }
        repository.save(n);
    }

    private static String truncate(String s) { return s == null ? null : s.substring(0, Math.min(s.length(), 500)); }
}
