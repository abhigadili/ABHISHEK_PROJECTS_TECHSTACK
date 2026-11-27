package com.hrportal.notification.entity;

import java.time.Instant;

import com.hrportal.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Business event history: a metadata row (and the payload, except for topics carrying money) per Kafka event seen on any topic. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "event_history", uniqueConstraints = @UniqueConstraint(name = "uk_event_history_event", columnNames = "eventId"),
        indexes = {@Index(name = "idx_event_topic", columnList = "topic,occurredAt"), @Index(name = "idx_event_employee", columnList = "employeeId,occurredAt")})
public class EventHistory extends BaseEntity {
    @Column(nullable = false, length = 64)
    private String eventId;
    @Column(nullable = false, length = 100)
    private String topic;
    @Column(length = 100)
    private String eventType;
    @Column(length = 36)
    private String employeeId;
    @Column(length = 60)
    private String sourceService;
    @Column(length = 64)
    private String correlationId;
    @Column(nullable = false)
    private Instant occurredAt;
    @Column(nullable = false)
    private int partitionNo;
    @Column(nullable = false)
    private long offsetNo;
    @Column(columnDefinition = "MEDIUMTEXT")
    private String payload;
}
