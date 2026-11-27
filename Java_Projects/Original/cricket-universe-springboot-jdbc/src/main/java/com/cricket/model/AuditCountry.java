package com.cricket.model;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_countries', populated exclusively by DB triggers. */
public class AuditCountry {

    private Integer auditId;
    private String operation;
    private String recordId;
    private String oldName;
    private String newName;
    private String oldCaptain;
    private String newCaptain;
    private String oldCoach;
    private String newCoach;
    private Integer oldWorldCupsWon;
    private Integer newWorldCupsWon;
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

    public String getOldCaptain() { return oldCaptain; }
    public void setOldCaptain(String oldCaptain) { this.oldCaptain = oldCaptain; }

    public String getNewCaptain() { return newCaptain; }
    public void setNewCaptain(String newCaptain) { this.newCaptain = newCaptain; }

    public String getOldCoach() { return oldCoach; }
    public void setOldCoach(String oldCoach) { this.oldCoach = oldCoach; }

    public String getNewCoach() { return newCoach; }
    public void setNewCoach(String newCoach) { this.newCoach = newCoach; }

    public Integer getOldWorldCupsWon() { return oldWorldCupsWon; }
    public void setOldWorldCupsWon(Integer oldWorldCupsWon) { this.oldWorldCupsWon = oldWorldCupsWon; }

    public Integer getNewWorldCupsWon() { return newWorldCupsWon; }
    public void setNewWorldCupsWon(Integer newWorldCupsWon) { this.newWorldCupsWon = newWorldCupsWon; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
}
