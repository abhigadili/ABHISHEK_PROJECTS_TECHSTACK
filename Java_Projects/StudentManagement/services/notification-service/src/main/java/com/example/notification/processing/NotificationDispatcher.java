package com.example.notification.processing;

import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.repository.NotificationRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Background job: picks up due PENDING notifications (new ones + retries whose backoff has elapsed). */
@Component
public class NotificationDispatcher {
    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);
    private final NotificationRepository repository;
    private final NotificationProcessor processor;
    private final int batchSize;

    public NotificationDispatcher(NotificationRepository repository, NotificationProcessor processor,
                                  @Value("${notification.dispatch.batch-size:50}") int batchSize) {
        this.repository = repository; this.processor = processor; this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${notification.dispatch.interval-ms:2000}")
    public void dispatch() {
        List<Notification> due = repository.findDue(NotificationStatus.PENDING, LocalDateTime.now(), PageRequest.of(0, batchSize));
        if (due.isEmpty()) return;
        log.debug("Dispatching {} notifications", due.size());
        for (Notification n : due) {
            try {
                processor.process(n.getNotificationId());
            } catch (RuntimeException e) {
                log.error("Unexpected error processing notification {}", n.getNotificationId(), e);
            }
        }
    }
}
