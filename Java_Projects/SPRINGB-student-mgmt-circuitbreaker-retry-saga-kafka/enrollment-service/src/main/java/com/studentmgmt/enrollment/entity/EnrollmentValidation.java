package com.studentmgmt.enrollment.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Tracks the two async Saga validation replies for one enrollment. NULL in
 * either *_valid column means "reply not received yet". See
 * EnrollmentSagaService for how this drives CONFIRMED/REJECTED resolution.
 */
@Entity
@Table(name = "Enrollment_Validation")
public class EnrollmentValidation {

    @Id
    @Column(name = "enrollment_id")
    private Long enrollmentId;

    @Column(name = "student_valid")
    private Boolean studentValid;

    @Column(name = "student_reason")
    private String studentReason;

    @Column(name = "student_checked_at")
    private LocalDateTime studentCheckedAt;

    @Column(name = "course_valid")
    private Boolean courseValid;

    @Column(name = "course_reason")
    private String courseReason;

    @Column(name = "course_checked_at")
    private LocalDateTime courseCheckedAt;

    /** Both replies have arrived — the saga can now be resolved one way or the other. */
    @Transient
    public boolean isResolved() {
        return studentValid != null && courseValid != null;
    }

    /** Only meaningful once isResolved() is true. */
    @Transient
    public boolean isFullyValid() {
        return Boolean.TRUE.equals(studentValid) && Boolean.TRUE.equals(courseValid);
    }

    public Long getEnrollmentId() {
        return enrollmentId;
    }

    public void setEnrollmentId(Long enrollmentId) {
        this.enrollmentId = enrollmentId;
    }

    public Boolean getStudentValid() {
        return studentValid;
    }

    public void setStudentValid(Boolean studentValid) {
        this.studentValid = studentValid;
    }

    public String getStudentReason() {
        return studentReason;
    }

    public void setStudentReason(String studentReason) {
        this.studentReason = studentReason;
    }

    public LocalDateTime getStudentCheckedAt() {
        return studentCheckedAt;
    }

    public void setStudentCheckedAt(LocalDateTime studentCheckedAt) {
        this.studentCheckedAt = studentCheckedAt;
    }

    public Boolean getCourseValid() {
        return courseValid;
    }

    public void setCourseValid(Boolean courseValid) {
        this.courseValid = courseValid;
    }

    public String getCourseReason() {
        return courseReason;
    }

    public void setCourseReason(String courseReason) {
        this.courseReason = courseReason;
    }

    public LocalDateTime getCourseCheckedAt() {
        return courseCheckedAt;
    }

    public void setCourseCheckedAt(LocalDateTime courseCheckedAt) {
        this.courseCheckedAt = courseCheckedAt;
    }
}
