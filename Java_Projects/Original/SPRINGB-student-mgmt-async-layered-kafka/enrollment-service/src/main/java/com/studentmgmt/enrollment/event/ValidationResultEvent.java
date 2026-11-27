package com.studentmgmt.enrollment.event;

/**
 * enrollment-service's own copy of the message shape published by both
 * student-service (`student.validation.result`) and course-service
 * (`course.validation.result`) — the two topics share this same JSON
 * contract, only the topic name tells them apart.
 */
public class ValidationResultEvent {

    private Long enrollmentId;
    private boolean valid;
    private String reason;
    private String source;
    private String checkedAt;

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
