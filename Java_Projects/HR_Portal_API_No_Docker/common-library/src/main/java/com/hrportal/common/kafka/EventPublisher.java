package com.hrportal.common.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.events.HrEvent;

import java.time.Instant;

/**
 * Producer side of the transactional-outbox pattern:
 * 1) the event row is saved inside the caller's DB transaction (state change and event are atomic);
 * 2) right after commit we try to send it immediately;
 * 3) {@link OutboxRelay} re-sends anything still unsent (broker down, crash) - at-least-once delivery, consumers are idempotent.
 * Messages are keyed (usually by employee id) so all events of one employee land on one partition, preserving order.
 */
@Service
public class EventPublisher {
    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);
    private final OutboxEventRepository outbox;
    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;

    public EventPublisher(OutboxEventRepository outbox, KafkaTemplate<String, String> kafka, ObjectMapper mapper) {
        this.outbox = outbox;
        this.kafka = kafka;
        this.mapper = mapper;
    }

    @Transactional
    public void publish(String topic, String key, HrEvent event) {
        OutboxEvent row = new OutboxEvent();
        row.setTopic(topic);
        row.setEventKey(key);
        try {
            row.setPayload(mapper.writeValueAsString(event));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise event " + event.getClass().getSimpleName(), e);
        }
        OutboxEvent saved = outbox.save(row);
        log.info("Event queued topic={} key={} eventId={} outbox#{}", topic, key, event.eventId(), saved.getId());
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
                log.warn("Kafka send failed for outbox#{} topic={} (relay will retry): {}", row.getId(), row.getTopic(), ex.toString());
                return;
            }
            outbox.findById(row.getId()).ifPresent(r -> {
                r.setSentAt(Instant.now());
                r.setAttempts(r.getAttempts() + 1);
                outbox.save(r);
            });
            log.info("Event published topic={} partition={} offset={} outbox#{}", row.getTopic(),
                    result.getRecordMetadata().partition(), result.getRecordMetadata().offset(), row.getId());
        });
    }
}
