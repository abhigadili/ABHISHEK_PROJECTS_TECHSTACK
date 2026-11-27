package com.studentmgmt.enrollment.event;

/**
 * Published once the saga resolves both validation replies — to
 * `enrollment.confirmed` when both sides are valid, or `enrollment.rejected`
 * otherwise. notification-service consumes both topics and defines its own
 * copy of this same shape.
 */
public class EnrollmentOutcomeEvent {

    private Long enrollmentId;
    private Long studentId;
    private Long courseId;
    private String status;
    private String reason;
    private String occurredAt;

    public EnrollmentOutcomeEvent() {
    }

    public EnrollmentOutcomeEvent(Long enrollmentId, Long studentId, Long courseId, String status, String reason, String occurredAt) {
        this.enrollmentId = enrollmentId;
        this.studentId = studentId;
        this.courseId = courseId;
        this.status = status;
        this.reason = reason;
        this.occurredAt = occurredAt;
    }

    public Long getEnrollmentId() {
        return enrollmentId;
    }

    public void setEnrollmentId(Long enrollmentId) {
        this.enrollmentId = enrollmentId;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(String occurredAt) {
        this.occurredAt = occurredAt;
    }
}
