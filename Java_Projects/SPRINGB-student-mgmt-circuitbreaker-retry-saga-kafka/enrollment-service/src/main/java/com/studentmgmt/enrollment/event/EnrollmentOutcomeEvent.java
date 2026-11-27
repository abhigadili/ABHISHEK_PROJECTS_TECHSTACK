package com.studentmgmt.enrollment.event;

/** Published to `enrollment.confirmed` or `enrollment.rejected` once the Saga resolves — notification-service reacts to this. */
public class EnrollmentOutcomeEvent {

    private Long enrollmentId;
    private Long studentId;
    private Long courseId;
    private String status;
    private String reason;
    private String resolvedAt;

    public EnrollmentOutcomeEvent() {
    }

    public EnrollmentOutcomeEvent(Long enrollmentId, Long studentId, Long courseId, String status, String reason, String resolvedAt) {
        this.enrollmentId = enrollmentId;
        this.studentId = studentId;
        this.courseId = courseId;
        this.status = status;
        this.reason = reason;
        this.resolvedAt = resolvedAt;
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

    public String getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(String resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}
