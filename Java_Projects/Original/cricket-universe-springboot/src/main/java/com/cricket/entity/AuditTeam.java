package com.cricket.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_teams', populated exclusively by DB triggers. */
@Entity
@Table(name = "audit_teams")
public class AuditTeam {

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

    @Column(name = "old_league_id", length = 60)
    private String oldLeagueId;

    @Column(name = "new_league_id", length = 60)
    private String newLeagueId;

    @Column(name = "old_captain", length = 100)
    private String oldCaptain;

    @Column(name = "new_captain", length = 100)
    private String newCaptain;

    @Column(name = "old_titles")
    private Integer oldTitles;

    @Column(name = "new_titles")
    private Integer newTitles;

    @Column(name = "changed_by", length = 255)
    private String changedBy;

    @Column(name = "changed_at")
    private LocalDateTime changedAt;

    public Integer getAuditId() { return auditId; }
    public String getOperation() { return operation; }
    public String getRecordId() { return recordId; }
    public String getOldName() { return oldName; }
    public String getNewName() { return newName; }
    public String getOldLeagueId() { return oldLeagueId; }
    public String getNewLeagueId() { return newLeagueId; }
    public String getOldCaptain() { return oldCaptain; }
    public String getNewCaptain() { return newCaptain; }
    public Integer getOldTitles() { return oldTitles; }
    public Integer getNewTitles() { return newTitles; }
    public String getChangedBy() { return changedBy; }
    public LocalDateTime getChangedAt() { return changedAt; }
}
