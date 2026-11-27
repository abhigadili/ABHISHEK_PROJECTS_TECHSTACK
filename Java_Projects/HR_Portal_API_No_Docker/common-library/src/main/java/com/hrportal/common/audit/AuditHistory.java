package com.hrportal.common.audit;

import java.time.Instant;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Append-only business audit trail (one table per service database). {@code @Immutable} stops Hibernate from ever
 * issuing UPDATEs, and MySQL triggers (see the V2 migrations) reject UPDATE / DELETE statements outright.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Immutable
@Table(name = "audit_history", indexes = {
        @Index(name = "idx_audit_entity", columnList = "entityType,entityId"),
        @Index(name = "idx_audit_created", columnList = "createdAt")})
public class AuditHistory {
    @Id
    @UuidGenerator
    @Column(length = 36, updatable = false)
    private String id;
    @Column(nullable = false, length = 80, updatable = false)
    private String entityType;
    @Column(nullable = false, length = 64, updatable = false)
    private String entityId;
    @Column(nullable = false, length = 60, updatable = false)
    private String action;
    @Column(columnDefinition = "MEDIUMTEXT", updatable = false)
    private String previousValue;
    @Column(columnDefinition = "MEDIUMTEXT", updatable = false)
    private String newValue;
    @Column(length = 100, updatable = false)
    private String userId;
    @Column(length = 64, updatable = false)
    private String correlationId;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
