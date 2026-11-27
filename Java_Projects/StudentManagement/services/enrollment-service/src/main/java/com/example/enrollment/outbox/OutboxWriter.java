package com.example.enrollment.outbox;

import com.example.enrollment.entity.OutboxEvent;
import com.example.enrollment.repository.OutboxEventRepository;
import com.example.events.EnrollmentEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OutboxWriter {
    private final OutboxEventRepository repository;
    private final ObjectMapper mapper;

    public OutboxWriter(OutboxEventRepository repository, ObjectMapper mapper) { this.repository = repository; this.mapper = mapper; }

    /** Inserts the event row inside the caller's transaction (commits or rolls back together with the business change). */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent store(String topic, String key, EnrollmentEvent event) {
        OutboxEvent o = new OutboxEvent();
        o.setEventId(event.eventId());
        o.setAggregateId(event.enrollmentId());
        o.setEventType(event.eventType().name());
        o.setTopic(topic);
        o.setEventKey(key);
        try {
            o.setPayload(mapper.writeValueAsString(event));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize event " + event.eventId(), e);
        }
        return repository.save(o);
    }
}
