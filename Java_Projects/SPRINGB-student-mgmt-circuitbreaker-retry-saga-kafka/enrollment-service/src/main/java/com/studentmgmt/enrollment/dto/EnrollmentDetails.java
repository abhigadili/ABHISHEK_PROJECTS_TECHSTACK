package com.studentmgmt.enrollment.dto;

/** Response shape for GET /api/enrollments/{id}/details — aggregates the local Enrollment row with live data fetched (or gracefully degraded) from student-service and course-service. */
public class EnrollmentDetails {

    private Long enrollmentId;
    private String status;
    private StudentSummary student;
    private CourseSummary course;

    public EnrollmentDetails(Long enrollmentId, String status, StudentSummary student, CourseSummary course) {
        this.enrollmentId = enrollmentId;
        this.status = status;
        this.student = student;
        this.course = course;
    }

    public Long getEnrollmentId() {
        return enrollmentId;
    }

    public String getStatus() {
        return status;
    }

    public StudentSummary getStudent() {
        return student;
    }

    public CourseSummary getCourse() {
        return course;
    }
}
