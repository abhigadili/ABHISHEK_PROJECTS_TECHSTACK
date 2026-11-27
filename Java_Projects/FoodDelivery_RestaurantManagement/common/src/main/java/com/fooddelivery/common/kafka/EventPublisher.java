package com.fooddelivery.common.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fooddelivery.common.kafka.outbox.OutboxEvent;
import com.fooddelivery.common.kafka.outbox.OutboxRepository;
import com.fooddelivery.common.web.Correlation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Producer-side entry point. It does NOT talk to Kafka: it stores the event in the outbox table inside the caller's
 * database transaction ({@link Propagation#MANDATORY}), so "business change committed" and "event will be published"
 * can never diverge. {@link OutboxRelay} ships rows to Kafka afterwards.
 */
@Component
public class EventPublisher {
    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);
    public static final String VERSION = "1.0";
    private final OutboxRepository outbox;
    private final ObjectMapper mapper;
    private final String service;

    public EventPublisher(OutboxRepository outbox, ObjectMapper mapper, @Value("${spring.application.name}") String service) {
        this.outbox = outbox;
        this.mapper = mapper;
        this.service = service;
    }

    /**
     * @param key partition key: all events of one aggregate (e.g. an order id) share a partition, preserving their order
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public EventEnvelope publish(String topic, String eventType, String aggregateId, String key, Object payload) {
        String eventId = UUID.randomUUID().toString();
        String correlationId = Correlation.currentOrNew();
        EventEnvelope env = new EventEnvelope(eventId, eventType, VERSION, Instant.now(), aggregateId, correlationId, service,
                mapper.valueToTree(payload));
        OutboxEvent row = new OutboxEvent();
        row.setId(eventId);
        row.setTopic(topic);
        row.setMsgKey(key);
        row.setEventType(eventType);
        row.setCorrelationId(correlationId);
        try {
            row.setEnvelopeJson(mapper.writeValueAsString(env));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise event " + eventType, e);
        }
        outbox.save(row);
        log.info("Outbox: queued {} for topic {} key={} eventId={}", eventType, topic, key, eventId);
        return env;
    }
}
