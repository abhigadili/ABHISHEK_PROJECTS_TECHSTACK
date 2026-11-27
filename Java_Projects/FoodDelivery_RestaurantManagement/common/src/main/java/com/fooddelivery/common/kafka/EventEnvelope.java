package com.fooddelivery.common.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

import java.time.Instant;

/**
 * The common envelope of every business event on Kafka (JSON string value).
 * Backward compatibility: consumers ignore unknown payload fields; breaking changes bump {@code eventVersion}.
 */
public record EventEnvelope(String eventId, String eventType, String eventVersion, Instant eventTimestamp,
                            String aggregateId, String correlationId, String producerService, JsonNode payload) {

    public <T> T payloadAs(ObjectMapper mapper, Class<T> type) throws JsonProcessingException {
        return mapper.treeToValue(payload, type);
    }
}
