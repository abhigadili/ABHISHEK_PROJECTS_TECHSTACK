package com.studentmgmt.enrollment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Tracks the two async validation replies for one enrollment request. NULL
 * means "reply not received yet" for that side. The saga is resolved only
 * once both studentValid and courseValid are non-null. The primary key IS
 * the enrollment id — this is a 1:1 child of Enrollments, not an
 * auto-incrementing row of its own.
 */
@Entity
@Table(name = "Enrollment_Validation")
public class EnrollmentValidation {

    @Id
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "student_valid")
    private Boolean studentValid;

    @Column(name = "student_reason", length = 255)
    private String studentReason;

    @Column(name = "student_checked_at")
    private LocalDateTime studentCheckedAt;

    @Column(name = "course_valid")
    private Boolean courseValid;

    @Column(name = "course_reason", length = 255)
    private String courseReason;

    @Column(name = "course_checked_at")
    private LocalDateTime courseCheckedAt;

    public EnrollmentValidation() {}

    public EnrollmentValidation(Long enrollmentId) {
        this.enrollmentId = enrollmentId;
    }

    public Long getEnrollmentId() { return enrollmentId; }
    public void setEnrollmentId(Long enrollmentId) { this.enrollmentId = enrollmentId; }

    public Boolean getStudentValid() { return studentValid; }
    public void setStudentValid(Boolean studentValid) { this.studentValid = studentValid; }

    public String getStudentReason() { return studentReason; }
    public void setStudentReason(String studentReason) { this.studentReason = studentReason; }

    public LocalDateTime getStudentCheckedAt() { return studentCheckedAt; }
    public void setStudentCheckedAt(LocalDateTime studentCheckedAt) { this.studentCheckedAt = studentCheckedAt; }

    public Boolean getCourseValid() { return courseValid; }
    public void setCourseValid(Boolean courseValid) { this.courseValid = courseValid; }

    public String getCourseReason() { return courseReason; }
    public void setCourseReason(String courseReason) { this.courseReason = courseReason; }

    public LocalDateTime getCourseCheckedAt() { return courseCheckedAt; }
    public void setCourseCheckedAt(LocalDateTime courseCheckedAt) { this.courseCheckedAt = courseCheckedAt; }

    /** True once both sides have replied, regardless of whether they passed. */
    public boolean isResolved() {
        return studentValid != null && courseValid != null;
    }

    public boolean isFullyValid() {
        return Boolean.TRUE.equals(studentValid) && Boolean.TRUE.equals(courseValid);
    }
}
