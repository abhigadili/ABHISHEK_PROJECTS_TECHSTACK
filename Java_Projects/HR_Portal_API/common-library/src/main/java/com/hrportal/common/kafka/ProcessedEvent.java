package com.hrportal.common.kafka;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Idempotency ledger: (eventId, consumer) may be processed only once - duplicate deliveries are skipped. */
@Getter
@NoArgsConstructor
@Entity
@Table(name = "processed_events",
        uniqueConstraints = @UniqueConstraint(name = "uk_processed_event_consumer", columnNames = {"eventId", "consumer"}))
public class ProcessedEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 64)
    private String eventId;
    @Column(nullable = false, length = 120)
    private String consumer;
    @Column(nullable = false)
    private Instant processedAt = Instant.now();

    public ProcessedEvent(String eventId, String consumer) {
        this.eventId = eventId;
        this.consumer = consumer;
    }
}
