package com.hospital.common.kafka;

import java.time.Instant;
import java.util.UUID;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.common.events.DomainEvent;

import lombok.extern.log4j.Log4j2;

/**
 * Publishes domain events with the transactional-outbox pattern:
 * 1) the event row is saved inside the caller's transaction (so state change and event are atomic);
 * 2) right after commit we try to send it immediately;
 * 3) {@link OutboxRelay} re-sends anything still unsent (broker down, crash) - at-least-once delivery,
 *    consumers are idempotent.
 */
@Log4j2
@Service
public class EventPublisher {
    private final OutboxEventRepository outbox;
    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;

    public EventPublisher(OutboxEventRepository outbox, KafkaTemplate<String, String> kafka, ObjectMapper mapper) {
        this.outbox = outbox;
        this.kafka = kafka;
        this.mapper = mapper;
    }

    public static String newId() {
        return UUID.randomUUID().toString();
    }

    public static Instant now() {
        return Instant.now();
    }

    @Transactional
    public void publish(String topic, String key, DomainEvent event) {
        OutboxEvent row = new OutboxEvent();
        row.setTopic(topic);
        row.setEventKey(key);
        try {
            row.setPayload(mapper.writeValueAsString(event));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise event " + event.getClass().getSimpleName(), e);
        }
        OutboxEvent saved = outbox.save(row);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendNow(saved);
                }
            });
        }
    }

    /** Fire-and-mark: on success the outbox row is stamped as sent, on failure the relay retries later. */
    void sendNow(OutboxEvent row) {
        kafka.send(row.getTopic(), row.getEventKey(), row.getPayload()).whenComplete((result, ex) -> {
            if (ex != null) {
                log.warn("Kafka send failed for outbox#{} topic={} (will be retried by relay): {}", row.getId(), row.getTopic(), ex.toString());
                return;
            }
            outbox.findById(row.getId()).ifPresent(r -> {
                r.setSentAt(Instant.now());
                r.setAttempts(r.getAttempts() + 1);
                outbox.save(r);
            });
            log.info("Published event topic={} key={} outbox#{}", row.getTopic(), row.getEventKey(), row.getId());
        });
    }
}
