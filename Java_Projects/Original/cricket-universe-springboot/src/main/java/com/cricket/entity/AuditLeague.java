package com.cricket.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_leagues', populated exclusively by DB triggers. */
@Entity
@Table(name = "audit_leagues")
public class AuditLeague {

    @Id
    @Column(name = "audit_id")
    private Integer auditId;

    @Column(name = "operation", length = 10)
    private String operation;

    @Column(name = "record_id", length = 60)
    private String recordId;

    @Column(name = "old_name", length = 200)
    private String oldName;

    @Column(name = "new_name", length = 200)
    private String newName;

    @Column(name = "old_country_id", length = 20)
    private String oldCountryId;

    @Column(name = "new_country_id", length = 20)
    private String newCountryId;

    @Column(name = "old_format", length = 20)
    private String oldFormat;

    @Column(name = "new_format", length = 20)
    private String newFormat;

    @Column(name = "changed_by", length = 255)
    private String changedBy;

    @Column(name = "changed_at")
    private LocalDateTime changedAt;

    public Integer getAuditId() { return auditId; }
    public String getOperation() { return operation; }
    public String getRecordId() { return recordId; }
    public String getOldName() { return oldName; }
    public String getNewName() { return newName; }
    public String getOldCountryId() { return oldCountryId; }
    public String getNewCountryId() { return newCountryId; }
    public String getOldFormat() { return oldFormat; }
    public String getNewFormat() { return newFormat; }
    public String getChangedBy() { return changedBy; }
    public LocalDateTime getChangedAt() { return changedAt; }
}
