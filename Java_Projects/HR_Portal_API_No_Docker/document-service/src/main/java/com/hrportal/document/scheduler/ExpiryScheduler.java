package com.hrportal.document.scheduler;

import java.time.Duration;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hrportal.common.cache.DistributedLockService;
import com.hrportal.document.producer.DocumentEventProducer;
import com.hrportal.document.repository.DocumentRepositories.DocumentRepository;

/** Daily 03:30 UTC: owners of documents expiring within 30 days are notified (once per document per day). */
@Component
public class ExpiryScheduler {
    private static final Logger log = LoggerFactory.getLogger(ExpiryScheduler.class);
    private final DocumentRepository documents;
    private final DocumentEventProducer producer;
    private final DistributedLockService locks;
    private final TransactionTemplate tx;

    public ExpiryScheduler(DocumentRepository documents, DocumentEventProducer producer, DistributedLockService locks, TransactionTemplate tx) {
        this.documents = documents;
        this.producer = producer;
        this.locks = locks;
        this.tx = tx;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    public void notifyExpiring() {
        try {
            locks.withLock("document-expiry", Duration.ofMinutes(5), () -> tx.executeWithoutResult(s -> {
                LocalDate today = LocalDate.now();
                int[] n = {0};
                documents.findExpiringBy(today.plusDays(30)).stream().filter(d -> !d.getExpiryDate().isBefore(today)).forEach(d -> {
                    producer.expiring(d, today.toString());
                    n[0]++;
                });
                log.info("Expiry job queued {} notification(s)", n[0]);
            }));
        } catch (RuntimeException e) {
            log.warn("Expiry job skipped: {}", e.getMessage());
        }
    }
}
