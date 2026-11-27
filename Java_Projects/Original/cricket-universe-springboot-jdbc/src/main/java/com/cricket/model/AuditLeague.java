package com.cricket.model;

import java.time.LocalDateTime;

/** Read-only mapping of 'audit_leagues', populated exclusively by DB triggers. */
public class AuditLeague {

    private Integer auditId;
    private String operation;
    private String recordId;
    private String oldName;
    private String newName;
    private String oldCountryId;
    private String newCountryId;
    private String oldFormat;
    private String newFormat;
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

    public String getOldCountryId() { return oldCountryId; }
    public void setOldCountryId(String oldCountryId) { this.oldCountryId = oldCountryId; }

    public String getNewCountryId() { return newCountryId; }
    public void setNewCountryId(String newCountryId) { this.newCountryId = newCountryId; }

    public String getOldFormat() { return oldFormat; }
    public void setOldFormat(String oldFormat) { this.oldFormat = oldFormat; }

    public String getNewFormat() { return newFormat; }
    public void setNewFormat(String newFormat) { this.newFormat = newFormat; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
}
