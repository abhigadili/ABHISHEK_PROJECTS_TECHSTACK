package com.studentmgmt.student.event;

/** Published by enrollment-service to topic `enrollment.requested`; consumed here to start the Saga's student-side check. */
public class EnrollmentRequestedEvent {

    private Long enrollmentId;
    private Long studentId;
    private Long courseId;
    private String requestedAt;

    public EnrollmentRequestedEvent() {
    }

    public EnrollmentRequestedEvent(Long enrollmentId, Long studentId, Long courseId, String requestedAt) {
        this.enrollmentId = enrollmentId;
        this.studentId = studentId;
        this.courseId = courseId;
        this.requestedAt = requestedAt;
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

    public String getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(String requestedAt) {
        this.requestedAt = requestedAt;
    }
}
