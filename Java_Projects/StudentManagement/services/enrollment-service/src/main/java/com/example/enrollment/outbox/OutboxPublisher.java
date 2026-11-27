package com.example.enrollment.outbox;

import com.example.enrollment.entity.OutboxEvent;
import com.example.enrollment.entity.OutboxStatus;
import com.example.enrollment.repository.OutboxEventRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Background publisher of the transactional outbox. Each poll locks due rows (FOR UPDATE SKIP LOCKED), sends them to Kafka
 * and waits for the broker ack before marking PUBLISHED. Failures are retried with exponential back-off and never dropped,
 * so an event committed with its business change survives crashes of either the service or the broker (at-least-once;
 * consumers de-duplicate via their inbox).
 */
@Component
public class OutboxPublisher {
    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);

    private final OutboxEventRepository repository;
    private final KafkaTemplate<String, String> kafka;
    private final TransactionTemplate tx;
    private final int batchSize;
    private final long sendTimeoutSeconds;
    private final Counter published;
    private final Counter failed;

    public OutboxPublisher(OutboxEventRepository repository, KafkaTemplate<String, String> kafka, TransactionTemplate tx,
                           MeterRegistry meters, @Value("${enrollment.outbox.batch-size:50}") int batchSize,
                           @Value("${enrollment.outbox.send-timeout-seconds:5}") long sendTimeoutSeconds) {
        this.repository = repository; this.kafka = kafka; this.tx = tx; this.batchSize = batchSize; this.sendTimeoutSeconds = sendTimeoutSeconds;
        this.published = Counter.builder("outbox.events.published").register(meters);
        this.failed = Counter.builder("outbox.events.failed").register(meters);
        meters.gauge("outbox.events.pending", repository, r -> r.countByStatus(OutboxStatus.PENDING));
    }

    @Scheduled(fixedDelayString = "${enrollment.outbox.interval-ms:1000}")
    public void publishPending() {
        try {
            tx.executeWithoutResult(s -> publishBatch());
        } catch (RuntimeException e) {
            log.error("Outbox poll failed: {}", e.getMessage());
        }
    }

    /** Runs inside a transaction (public for tests). */
    public int publishBatch() {
        List<OutboxEvent> due = repository.lockDue(OutboxStatus.PENDING, LocalDateTime.now(), PageRequest.of(0, batchSize));
        Set<Long> blockedAggregates = new HashSet<>();   // keep per-enrollment ordering: after a failure skip its later events
        int ok = 0;
        for (OutboxEvent e : due) {
            if (blockedAggregates.contains(e.getAggregateId())) continue;
            try {
                ProducerRecord<String, String> rec = new ProducerRecord<>(e.getTopic(), e.getEventKey(), e.getPayload());
                rec.headers().add("eventId", e.getEventId().getBytes(StandardCharsets.UTF_8));
                rec.headers().add("eventType", e.getEventType().getBytes(StandardCharsets.UTF_8));
                var result = kafka.send(rec).get(sendTimeoutSeconds, TimeUnit.SECONDS);
                e.setStatus(OutboxStatus.PUBLISHED);
                e.setPublishedAt(LocalDateTime.now());
                e.setLastError(null);
                published.increment();
                ok++;
                log.info("Outbox published {} eventId={} -> {}-{}@{}", e.getEventType(), e.getEventId(), e.getTopic(),
                        result.getRecordMetadata().partition(), result.getRecordMetadata().offset());
            } catch (Exception ex) {
                if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
                e.setAttempts(e.getAttempts() + 1);
                long delay = Math.min(60, 1L << Math.min(e.getAttempts(), 6));
                e.setNextAttemptAt(LocalDateTime.now().plusSeconds(delay));
                String msg = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
                e.setLastError(msg.substring(0, Math.min(msg.length(), 500)));
                blockedAggregates.add(e.getAggregateId());
                failed.increment();
                log.warn("Outbox publish failed eventId={} attempt={} retry in {}s: {}", e.getEventId(), e.getAttempts(), delay, msg);
            }
        }
        repository.saveAll(due);
        return ok;
    }
}
