package com.fooddelivery.common.kafka.outbox;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, Long> {
    boolean existsByEventIdAndConsumerGroup(String eventId, String consumerGroup);
}
