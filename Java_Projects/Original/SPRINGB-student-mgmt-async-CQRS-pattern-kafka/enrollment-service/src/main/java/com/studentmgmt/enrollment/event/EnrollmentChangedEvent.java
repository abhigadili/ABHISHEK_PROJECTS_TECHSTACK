package com.studentmgmt.enrollment.event;

/**
 * Published to `enrollment.changed` — the CQRS projection signal, consumed
 * only by this service's own EnrollmentChangedProjector to keep
 * Enrollments_View in sync. Fired twice per enrollment lifecycle in the
 * common case: once by EnrollmentCommandService.create() (status
 * PENDING_VALIDATION) and again by EnrollmentSagaService once the saga
 * resolves (status CONFIRMED/REJECTED). statusName is denormalized here —
 * looked up once by whichever service method fires the event — so the read
 * side never joins Enrollment_Status.
 */
public class EnrollmentChangedEvent {

    public static final String CREATED = "CREATED";
    public static final String UPDATED = "UPDATED";
    public static final String DELETED = "DELETED";

    private String operation;
    private Long enrollmentId;
    private Long studentId;
    private Long courseId;
    private Long statusId;
    private String statusName;
    private String enrollmentDate;
    private String completionDate;
    private String rejectionReason;

    public String getOperation() {
        return operation;
    }

    public void setOperation(String operation) {
        this.operation = operation;
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

    public Long getStatusId() {
        return statusId;
    }

    public void setStatusId(Long statusId) {
        this.statusId = statusId;
    }

    public String getStatusName() {
        return statusName;
    }

    public void setStatusName(String statusName) {
        this.statusName = statusName;
    }

    public String getEnrollmentDate() {
        return enrollmentDate;
    }

    public void setEnrollmentDate(String enrollmentDate) {
        this.enrollmentDate = enrollmentDate;
    }

    public String getCompletionDate() {
        return completionDate;
    }

    public void setCompletionDate(String completionDate) {
        this.completionDate = completionDate;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}
