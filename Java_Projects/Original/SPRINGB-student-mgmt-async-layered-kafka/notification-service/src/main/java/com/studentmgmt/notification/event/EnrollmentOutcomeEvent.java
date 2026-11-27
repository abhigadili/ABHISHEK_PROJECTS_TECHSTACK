package com.studentmgmt.notification.event;

/**
 * notification-service's own copy of the message shape published by
 * enrollment-service on both `enrollment.confirmed` and `enrollment.rejected`
 * — the "status" field (CONFIRMED/REJECTED) tells the two apart just as much
 * as the topic name does.
 */
public class EnrollmentOutcomeEvent {

    private Long enrollmentId;
    private Long studentId;
    private Long courseId;
    private String status;
    private String reason;
    private String occurredAt;

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
