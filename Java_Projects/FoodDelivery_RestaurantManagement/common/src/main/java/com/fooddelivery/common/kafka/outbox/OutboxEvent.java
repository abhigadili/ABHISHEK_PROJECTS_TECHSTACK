package com.fooddelivery.common.kafka.outbox;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Transactional outbox row: written in the same DB transaction as the business change, relayed to Kafka afterwards. */
@Entity
@Table(name = "outbox_events", indexes = {@Index(name = "idx_outbox_status_created", columnList = "status,createdAt")})
@Getter @Setter @NoArgsConstructor
public class OutboxEvent {
    public enum Status { PENDING, PUBLISHED, FAILED }

    @Id @Column(length = 36)
    private String id;
    @Column(nullable = false, length = 100)
    private String topic;
    @Column(nullable = false, length = 100)
    private String msgKey;
    @Column(nullable = false, length = 100)
    private String eventType;
    @Column(length = 64)
    private String correlationId;
    @Lob @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String envelopeJson;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private Status status = Status.PENDING;
    private int attempts;
    @Column(length = 500)
    private String lastError;
    @Column(nullable = false)
    private Instant createdAt = Instant.now();
    private Instant publishedAt;
}
