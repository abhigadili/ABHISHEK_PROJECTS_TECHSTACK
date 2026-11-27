package com.fooddelivery.eventaudit.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One audit row per observation: PUBLISHED (seen on the topic: producer side) or CONSUMED (a consumer group's processing result).
 * Kept in MySQL (not Kafka) because the dashboard needs durable, filterable, paginated history long after topic retention expires,
 * plus joins with processing status - which Kafka alone cannot provide. The payload is stored MASKED.
 */
@Entity
@Table(name = "event_audit",
        uniqueConstraints = @UniqueConstraint(name = "uk_audit_dedupe", columnNames = "dedupeKey"),
        indexes = {@Index(name = "idx_audit_topic_time", columnList = "topic,eventTimestamp"), @Index(name = "idx_audit_event", columnList = "eventId"),
                @Index(name = "idx_audit_status", columnList = "status,processedAt"), @Index(name = "idx_audit_correlation", columnList = "correlationId"),
                @Index(name = "idx_audit_type", columnList = "eventType"), @Index(name = "idx_audit_role_time", columnList = "role,eventTimestamp")})
@Getter @Setter @NoArgsConstructor
public class EventAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    /** P:topic:partition:offset  or  C:eventId:consumerGroup  (makes upserts idempotent). */
    @Column(nullable = false, length = 200) private String dedupeKey;
    @Column(nullable = false, length = 10) private String role;
    @Column(length = 36) private String eventId;
    @Column(nullable = false, length = 100) private String topic;
    private Integer partitionNo;
    private Long offsetNo;
    @Column(length = 100) private String msgKey;
    @Column(length = 60) private String eventType;
    @Column(length = 60) private String producerService;
    @Column(length = 60) private String consumerService;
    @Column(length = 100) private String consumerGroup;
    @Column(length = 100) private String consumerClass;
    private Instant eventTimestamp;
    private Instant processedAt;
    /** PUBLISHED for producer rows; PROCESSED / DUPLICATE_IGNORED / FAILED / DEAD_LETTERED / REJECTED_INVALID for consumer rows. */
    @Column(nullable = false, length = 20) private String status;
    private Integer attempts;
    private Long durationMs;
    @Column(length = 600) private String errorDetails;
    @Column(length = 64) private String correlationId;
    @Lob @Column(columnDefinition = "TEXT") private String payloadMasked;
    @Column(length = 600) private String headersJson;
    @Column(nullable = false) private int replayCount;
    private Instant lastReplayAt;
    @Column(nullable = false) private Instant recordedAt = Instant.now();
}
