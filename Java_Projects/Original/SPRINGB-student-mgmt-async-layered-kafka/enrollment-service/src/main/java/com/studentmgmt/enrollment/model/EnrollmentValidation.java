package com.studentmgmt.enrollment.model;

import java.time.LocalDateTime;

/**
 * Tracks the two async validation replies for one enrollment request. NULL
 * means "reply not received yet" for that side. The saga is resolved only
 * once both studentValid and courseValid are non-null.
 */
public class EnrollmentValidation {

    private Long enrollmentId;
    private Boolean studentValid;
    private String studentReason;
    private LocalDateTime studentCheckedAt;
    private Boolean courseValid;
    private String courseReason;
    private LocalDateTime courseCheckedAt;

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

    /** True once both sides have replied, regardless of whether they passed. */
    public boolean isResolved() {
        return studentValid != null && courseValid != null;
    }

    public boolean isFullyValid() {
        return Boolean.TRUE.equals(studentValid) && Boolean.TRUE.equals(courseValid);
    }
}
