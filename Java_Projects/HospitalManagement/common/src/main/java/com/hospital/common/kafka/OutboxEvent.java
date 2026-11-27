package com.hospital.common.kafka;

import java.time.Instant;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Transactional outbox row: written in the same DB transaction as the business change. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "outbox_events", indexes = @Index(name = "idx_outbox_unsent", columnList = "sentAt,createdAt"))
public class OutboxEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 150)
    private String topic;
    @Column(name = "event_key", length = 100)
    private String eventKey;
    @Lob
    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String payload;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant sentAt;
    @Column(nullable = false)
    private int attempts;
}
