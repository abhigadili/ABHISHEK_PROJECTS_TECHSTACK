package com.cricket.model;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_cricketers', populated exclusively by DB triggers. */
public class AuditCricketer {

    private Integer auditId;
    private String operation;
    private String recordId;
    private String oldName;
    private String newName;
    private String oldTeamId;
    private String newTeamId;
    private String oldRole;
    private String newRole;
    private Integer oldRuns;
    private Integer newRuns;
    private Integer oldWickets;
    private Integer newWickets;
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

    public String getOldTeamId() { return oldTeamId; }
    public void setOldTeamId(String oldTeamId) { this.oldTeamId = oldTeamId; }

    public String getNewTeamId() { return newTeamId; }
    public void setNewTeamId(String newTeamId) { this.newTeamId = newTeamId; }

    public String getOldRole() { return oldRole; }
    public void setOldRole(String oldRole) { this.oldRole = oldRole; }

    public String getNewRole() { return newRole; }
    public void setNewRole(String newRole) { this.newRole = newRole; }

    public Integer getOldRuns() { return oldRuns; }
    public void setOldRuns(Integer oldRuns) { this.oldRuns = oldRuns; }

    public Integer getNewRuns() { return newRuns; }
    public void setNewRuns(Integer newRuns) { this.newRuns = newRuns; }

    public Integer getOldWickets() { return oldWickets; }
    public void setOldWickets(Integer oldWickets) { this.oldWickets = oldWickets; }

    public Integer getNewWickets() { return newWickets; }
    public void setNewWickets(Integer newWickets) { this.newWickets = newWickets; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
}
