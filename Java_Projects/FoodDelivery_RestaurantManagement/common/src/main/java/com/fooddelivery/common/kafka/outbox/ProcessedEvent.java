package com.fooddelivery.common.kafka.outbox;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Idempotency ledger: one row per (event, consumer group) that was successfully handled. */
@Entity
@Table(name = "processed_events", uniqueConstraints = @UniqueConstraint(name = "uk_processed_event_group", columnNames = {"eventId", "consumerGroup"}))
@Getter @Setter @NoArgsConstructor
public class ProcessedEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 36)
    private String eventId;
    @Column(nullable = false, length = 100)
    private String consumerGroup;
    @Column(nullable = false, length = 100)
    private String topic;
    @Column(nullable = false)
    private Instant processedAt = Instant.now();

    public ProcessedEvent(String eventId, String consumerGroup, String topic) {
        this.eventId = eventId;
        this.consumerGroup = consumerGroup;
        this.topic = topic;
    }
}
