package com.hrportal.common.kafka;

import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.events.HrEvent;

/**
 * Wraps every Kafka listener body: deserialises the payload, skips events this consumer already handled and
 * records the event id in the SAME transaction as the handler's DB work (exactly-once effect on top of at-least-once
 * delivery). A malformed payload raises IllegalArgumentException, which the error handler treats as non-retryable
 * and sends straight to the dead-letter topic.
 */
@Service
public class IdempotentEventProcessor {
    private static final Logger log = LoggerFactory.getLogger(IdempotentEventProcessor.class);
    private final ProcessedEventRepository processed;
    private final ObjectMapper mapper;

    public IdempotentEventProcessor(ProcessedEventRepository processed, ObjectMapper mapper) {
        this.processed = processed;
        this.mapper = mapper;
    }

    @Transactional
    public <T extends HrEvent> void handle(String payload, Class<T> type, String consumer, Consumer<T> handler) {
        T event;
        try {
            event = mapper.readValue(payload, type);
        } catch (Exception e) {
            throw new IllegalArgumentException("Undeserialisable " + type.getSimpleName() + ": " + e.getMessage(), e);
        }
        String cid = event.metadata() == null ? null : event.metadata().correlationId();
        if (cid != null) MDC.put("correlationId", cid);
        try {
            if (processed.existsByEventIdAndConsumer(event.eventId(), consumer)) {
                log.info("Duplicate event {} ignored by {}", event.eventId(), consumer);
                return;
            }
            log.info("{} consuming {} eventId={}", consumer, type.getSimpleName(), event.eventId());
            handler.accept(event);
            processed.save(new ProcessedEvent(event.eventId(), consumer));
        } finally {
            MDC.remove("correlationId");
        }
    }
}
