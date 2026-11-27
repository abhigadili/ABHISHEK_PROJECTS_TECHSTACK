package com.fooddelivery.common.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/** Fire-and-forget publisher of consumer processing results (best effort: it never fails the business flow). */
@Component
public class AuditPublisher {
    private static final Logger log = LoggerFactory.getLogger(AuditPublisher.class);
    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;

    public AuditPublisher(KafkaTemplate<String, String> kafka, ObjectMapper mapper) {
        this.kafka = kafka;
        this.mapper = mapper;
    }

    public void send(ProcessingAudit audit) {
        try {
            kafka.send(Topics.AUDIT_PROCESSING, audit.eventId() == null ? "unknown" : audit.eventId(), mapper.writeValueAsString(audit))
                    .whenComplete((r, ex) -> { if (ex != null) log.warn("Could not publish processing audit: {}", ex.getMessage()); });
        } catch (Exception e) {
            log.warn("Could not serialise processing audit: {}", e.getMessage());
        }
    }
}
