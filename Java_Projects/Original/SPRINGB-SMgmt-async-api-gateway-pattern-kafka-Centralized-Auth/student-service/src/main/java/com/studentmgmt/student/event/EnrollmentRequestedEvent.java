package com.studentmgmt.student.event;

/**
 * student-service's own copy of the `enrollment.requested` message contract
 * published by enrollment-service. Each service keeps its own copy of the
 * event shapes it needs instead of sharing a common jar, so services stay
 * independently deployable/versionable — only the JSON field names on the
 * topic are the real contract.
 */
public class EnrollmentRequestedEvent {

    private Long enrollmentId;
    private Long studentId;
    private Long courseId;
    private String requestedAt;

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

    public String getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(String requestedAt) {
        this.requestedAt = requestedAt;
    }
}
