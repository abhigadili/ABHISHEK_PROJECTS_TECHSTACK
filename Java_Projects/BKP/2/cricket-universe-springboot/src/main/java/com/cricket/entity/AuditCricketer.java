package com.cricket.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_cricketers', populated exclusively by DB triggers. */
@Entity
@Table(name = "audit_cricketers")
public class AuditCricketer {

    @Id
    @Column(name = "audit_id")
    private Integer auditId;

    @Column(name = "operation", length = 10)
    private String operation;

    @Column(name = "record_id", length = 100)
    private String recordId;

    @Column(name = "old_name", length = 100)
    private String oldName;

    @Column(name = "new_name", length = 100)
    private String newName;

    @Column(name = "old_team_id", length = 60)
    private String oldTeamId;

    @Column(name = "new_team_id", length = 60)
    private String newTeamId;

    @Column(name = "old_role", length = 60)
    private String oldRole;

    @Column(name = "new_role", length = 60)
    private String newRole;

    @Column(name = "old_runs")
    private Integer oldRuns;

    @Column(name = "new_runs")
    private Integer newRuns;

    @Column(name = "old_wickets")
    private Integer oldWickets;

    @Column(name = "new_wickets")
    private Integer newWickets;

    @Column(name = "changed_by", length = 255)
    private String changedBy;

    @Column(name = "changed_at")
    private LocalDateTime changedAt;

    public Integer getAuditId() { return auditId; }
    public String getOperation() { return operation; }
    public String getRecordId() { return recordId; }
    public String getOldName() { return oldName; }
    public String getNewName() { return newName; }
    public String getOldTeamId() { return oldTeamId; }
    public String getNewTeamId() { return newTeamId; }
    public String getOldRole() { return oldRole; }
    public String getNewRole() { return newRole; }
    public Integer getOldRuns() { return oldRuns; }
    public Integer getNewRuns() { return newRuns; }
    public Integer getOldWickets() { return oldWickets; }
    public Integer getNewWickets() { return newWickets; }
    public String getChangedBy() { return changedBy; }
    public LocalDateTime getChangedAt() { return changedAt; }
}
