package com.cricket.model;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_teams', populated exclusively by DB triggers. */
public class AuditTeam {

    private Integer auditId;
    private String operation;
    private String recordId;
    private String oldName;
    private String newName;
    private String oldLeagueId;
    private String newLeagueId;
    private String oldCaptain;
    private String newCaptain;
    private Integer oldTitles;
    private Integer newTitles;
    private String changedBy;
    private LocalDateTime changedAt;

    public Integer getAuditId() { return auditId; }
    public void setAuditId(Integer auditId) { this.auditId = auditId; }

    public String getOperation() { return operation; }
    public void setOperation(String operation) { this.operation = operation; }

    public String getRecordId() { return recordId; }
    public void setRecordId(String recordId) { this.recordId = recordId; }

    public String getOldName() { return oldName; }
    public void setOldName(String oldName) { this.oldName = oldName; }

    public String getNewName() { return newName; }
    public void setNewName(String newName) { this.newName = newName; }

    public String getOldLeagueId() { return oldLeagueId; }
    public void setOldLeagueId(String oldLeagueId) { this.oldLeagueId = oldLeagueId; }

    public String getNewLeagueId() { return newLeagueId; }
    public void setNewLeagueId(String newLeagueId) { this.newLeagueId = newLeagueId; }

    public String getOldCaptain() { return oldCaptain; }
    public void setOldCaptain(String oldCaptain) { this.oldCaptain = oldCaptain; }

    public String getNewCaptain() { return newCaptain; }
    public void setNewCaptain(String newCaptain) { this.newCaptain = newCaptain; }

    public Integer getOldTitles() { return oldTitles; }
    public void setOldTitles(Integer oldTitles) { this.oldTitles = oldTitles; }

    public Integer getNewTitles() { return newTitles; }
    public void setNewTitles(Integer newTitles) { this.newTitles = newTitles; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
}
