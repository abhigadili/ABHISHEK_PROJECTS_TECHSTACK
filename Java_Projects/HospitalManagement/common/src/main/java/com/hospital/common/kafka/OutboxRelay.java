package com.hospital.common.kafka;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.extern.log4j.Log4j2;

/** Background job that re-sends outbox rows whose immediate send did not succeed. */
@Log4j2
@Component
public class OutboxRelay {
    private final OutboxEventRepository outbox;
    private final KafkaTemplate<String, String> kafka;
    private final Duration minAge;
    private final int batchSize;

    public OutboxRelay(OutboxEventRepository outbox, KafkaTemplate<String, String> kafka,
                       @Value("${hospital.outbox.min-age-seconds:15}") long minAgeSeconds,
                       @Value("${hospital.outbox.batch-size:50}") int batchSize) {
        this.outbox = outbox;
        this.kafka = kafka;
        this.minAge = Duration.ofSeconds(minAgeSeconds);
        this.batchSize = batchSize;
    }

    @Scheduled(fixedDelayString = "${hospital.outbox.relay-delay-ms:10000}", initialDelayString = "${hospital.outbox.relay-initial-delay-ms:20000}")
    public void relay() {
        for (OutboxEvent row : outbox.findBySentAtIsNullAndCreatedAtBeforeOrderByIdAsc(Instant.now().minus(minAge), PageRequest.of(0, batchSize))) {
            try {
                kafka.send(row.getTopic(), row.getEventKey(), row.getPayload()).get(5, TimeUnit.SECONDS);
                row.setSentAt(Instant.now());
                log.info("Outbox relay delivered outbox#{} topic={}", row.getId(), row.getTopic());
            } catch (Exception e) {
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                log.warn("Outbox relay could not deliver outbox#{} (attempt {}): {}", row.getId(), row.getAttempts() + 1, e.toString());
            }
            row.setAttempts(row.getAttempts() + 1);
            outbox.save(row);
        }
    }
}
