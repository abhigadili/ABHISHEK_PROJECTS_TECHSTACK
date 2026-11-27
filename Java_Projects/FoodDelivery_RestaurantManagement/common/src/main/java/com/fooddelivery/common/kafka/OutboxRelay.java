package com.fooddelivery.common.kafka;

import com.fooddelivery.common.kafka.outbox.OutboxEvent;
import com.fooddelivery.common.kafka.outbox.OutboxRepository;
import com.fooddelivery.common.web.Correlation;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Polling publisher of the transactional outbox. Rows are locked (SKIP LOCKED), sent in creation order with a
 * synchronous acknowledgement (so per-key ordering is preserved) and only then marked PUBLISHED.
 * If Kafka is down the rows simply stay PENDING and are retried: no event is lost.
 */
@Component
public class OutboxRelay {
    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);
    private static final int MAX_ATTEMPTS = 20;
    private final OutboxRepository repo;
    private final KafkaTemplate<String, String> kafka;
    private final TransactionTemplate tx;

    public OutboxRelay(OutboxRepository repo, KafkaTemplate<String, String> kafka, TransactionTemplate tx) {
        this.repo = repo;
        this.kafka = kafka;
        this.tx = tx;
    }

    @Scheduled(fixedDelayString = "${food.outbox.poll-ms:500}", initialDelayString = "${food.outbox.initial-delay-ms:5000}")
    public void relay() {
        try {
            tx.executeWithoutResult(status -> {
                List<OutboxEvent> batch = repo.findTop50ByStatusOrderByCreatedAtAsc(OutboxEvent.Status.PENDING);
                for (OutboxEvent e : batch) {
                    if (!send(e)) break;           // preserve order: stop at first failure, retry next tick
                }
            });
        } catch (Exception ex) {
            log.warn("Outbox relay cycle failed: {}", ex.getMessage());
        }
    }

    private boolean send(OutboxEvent e) {
        MDC.put(Correlation.MDC_KEY, e.getCorrelationId() == null ? "" : e.getCorrelationId());
        try {
            ProducerRecord<String, String> rec = new ProducerRecord<>(e.getTopic(), e.getMsgKey(), e.getEnvelopeJson());
            rec.headers().add("eventId", e.getId().getBytes(StandardCharsets.UTF_8));
            rec.headers().add("eventType", e.getEventType().getBytes(StandardCharsets.UTF_8));
            if (e.getCorrelationId() != null) rec.headers().add(Correlation.HEADER, e.getCorrelationId().getBytes(StandardCharsets.UTF_8));
            var result = kafka.send(rec).get(5, TimeUnit.SECONDS);
            e.setStatus(OutboxEvent.Status.PUBLISHED);
            e.setPublishedAt(Instant.now());
            e.setAttempts(e.getAttempts() + 1);
            var md = result.getRecordMetadata();
            log.info("Kafka published {} eventId={} topic={} partition={} offset={}", e.getEventType(), e.getId(), md.topic(), md.partition(), md.offset());
            return true;
        } catch (Exception ex) {
            e.setAttempts(e.getAttempts() + 1);
            String msg = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            e.setLastError(msg.length() > 480 ? msg.substring(0, 480) : msg);
            if (e.getAttempts() >= MAX_ATTEMPTS) e.setStatus(OutboxEvent.Status.FAILED);
            log.error("Kafka publish failed for {} eventId={} (attempt {}): {}", e.getEventType(), e.getId(), e.getAttempts(), msg);
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            return false;
        } finally {
            MDC.remove(Correlation.MDC_KEY);
        }
    }
}
