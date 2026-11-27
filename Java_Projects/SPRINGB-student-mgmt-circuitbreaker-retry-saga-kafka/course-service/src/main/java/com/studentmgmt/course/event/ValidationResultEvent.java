package com.studentmgmt.course.event;

public class ValidationResultEvent {

    private Long enrollmentId;
    private boolean valid;
    private String reason;
    private String source;
    private String checkedAt;

    public ValidationResultEvent() {
    }

    public ValidationResultEvent(Long enrollmentId, boolean valid, String reason, String source, String checkedAt) {
        this.enrollmentId = enrollmentId;
        this.valid = valid;
        this.reason = reason;
        this.source = source;
        this.checkedAt = checkedAt;
    }

    public Long getEnrollmentId() {
        return enrollmentId;
    }

    public void setEnrollmentId(Long enrollmentId) {
        this.enrollmentId = enrollmentId;
    }

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(String checkedAt) {
        this.checkedAt = checkedAt;
    }
}
