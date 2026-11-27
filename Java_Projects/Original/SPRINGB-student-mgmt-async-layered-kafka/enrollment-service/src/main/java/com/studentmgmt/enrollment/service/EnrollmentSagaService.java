package com.studentmgmt.enrollment.service;

public interface EnrollmentSagaService {

    /** Called by the Kafka listener for `student.validation.result`. */
    void applyStudentValidationResult(Long enrollmentId, boolean valid, String reason);

    /** Called by the Kafka listener for `course.validation.result`. */
    void applyCourseValidationResult(Long enrollmentId, boolean valid, String reason);
}
