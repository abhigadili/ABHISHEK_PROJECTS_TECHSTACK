package com.fooddelivery.common.kafka;

/** One edge of the producer/consumer map, discovered by reflection at startup (never hard-coded). */
public record TopologyEntry(String service, String role, String topic, String groupId, String className, String method) {}
