package com.cricket.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Read-only mapping of 'audit_countries'. Rows are inserted exclusively by DB
 * triggers on INSERT/UPDATE/DELETE against 'countries' — the application never
 * writes to this table directly.
 */
@Entity
@Table(name = "audit_countries")
public class AuditCountry {

    @Id
    @Column(name = "audit_id")
    private Integer auditId;

    @Column(name = "operation", length = 10)
    private String operation;

    @Column(name = "record_id", length = 20)
    private String recordId;

    @Column(name = "old_name", length = 100)
    private String oldName;

    @Column(name = "new_name", length = 100)
    private String newName;

    @Column(name = "old_captain", length = 100)
    private String oldCaptain;

    @Column(name = "new_captain", length = 100)
    private String newCaptain;

    @Column(name = "old_coach", length = 100)
    private String oldCoach;

    @Column(name = "new_coach", length = 100)
    private String newCoach;

    @Column(name = "old_world_cups_won")
    private Integer oldWorldCupsWon;

    @Column(name = "new_world_cups_won")
    private Integer newWorldCupsWon;

    @Column(name = "changed_by", length = 255)
    private String changedBy;

    @Column(name = "changed_at")
    private LocalDateTime changedAt;

    public Integer getAuditId() { return auditId; }
    public String getOperation() { return operation; }
    public String getRecordId() { return recordId; }
    public String getOldName() { return oldName; }
    public String getNewName() { return newName; }
    public String getOldCaptain() { return oldCaptain; }
    public String getNewCaptain() { return newCaptain; }
    public String getOldCoach() { return oldCoach; }
    public String getNewCoach() { return newCoach; }
    public Integer getOldWorldCupsWon() { return oldWorldCupsWon; }
    public Integer getNewWorldCupsWon() { return newWorldCupsWon; }
    public String getChangedBy() { return changedBy; }
    public LocalDateTime getChangedAt() { return changedAt; }
}
