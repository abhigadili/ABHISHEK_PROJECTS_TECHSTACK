package com.hrportal.common.events;

import java.time.Instant;
import java.util.UUID;

import org.slf4j.MDC;

/** Envelope metadata carried by every business event: id, type, schema version, timestamp, correlation id, origin. */
public record EventMetadata(String eventId, String eventType, int version, Instant timestamp,
                            String correlationId, String sourceService) {
    /** Set once at startup by KafkaCommonConfig (the spring.application.name of the running service). */
    public static volatile String SERVICE_NAME = "unknown";

    public static EventMetadata of(String eventType) {
        String cid = MDC.get("correlationId");
        return new EventMetadata(UUID.randomUUID().toString(), eventType, 1, Instant.now(),
                cid == null ? UUID.randomUUID().toString() : cid, SERVICE_NAME);
    }
}
