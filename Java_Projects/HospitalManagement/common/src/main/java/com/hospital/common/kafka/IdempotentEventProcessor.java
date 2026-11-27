package com.hospital.common.kafka;

import java.util.function.Consumer;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.common.events.DomainEvent;

import lombok.extern.log4j.Log4j2;

/**
 * Wraps every Kafka listener: deserialises the payload, skips events this consumer already handled and
 * records the event id in the same transaction as the handler's DB work (exactly-once effect on top of
 * at-least-once delivery). A malformed payload raises IllegalArgumentException, which the error handler
 * treats as non-retryable and sends straight to the dead-letter topic.
 */
@Log4j2
@Service
public class IdempotentEventProcessor {
    private final ProcessedEventRepository processed;
    private final ObjectMapper mapper;

    public IdempotentEventProcessor(ProcessedEventRepository processed, ObjectMapper mapper) {
        this.processed = processed;
        this.mapper = mapper;
    }

    @Transactional
    public <T extends DomainEvent> void handle(String payload, Class<T> type, String consumer, Consumer<T> handler) {
        T event;
        try {
            event = mapper.readValue(payload, type);
        } catch (Exception e) {
            throw new IllegalArgumentException("Undeserialisable " + type.getSimpleName() + ": " + e.getMessage(), e);
        }
        if (processed.existsByEventIdAndConsumer(event.eventId(), consumer)) {
            log.info("Duplicate event {} ignored by {}", event.eventId(), consumer);
            return;
        }
        log.info("{} handling {} {}", consumer, type.getSimpleName(), event.eventId());
        handler.accept(event);
        processed.save(new ProcessedEvent(event.eventId(), consumer));
    }
}
