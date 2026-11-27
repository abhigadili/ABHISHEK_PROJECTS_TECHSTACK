package com.fooddelivery.common.kafka;

import java.time.Instant;

/** Published on {@code audit.event-processing} whenever a consumer finishes (or fails) with a message. */
public record ProcessingAudit(String eventId, String eventType, String topic, int partition, long offset, String key,
                              String consumerService, String consumerGroup, String consumerClass, String status,
                              int attempt, long durationMs, String error, Instant processedAt, String correlationId,
                              boolean replay) {
    public static final String PROCESSED = "PROCESSED";
    public static final String DUPLICATE_IGNORED = "DUPLICATE_IGNORED";
    public static final String FAILED = "FAILED";
    public static final String DEAD_LETTERED = "DEAD_LETTERED";
    public static final String REJECTED_INVALID = "REJECTED_INVALID";
}
