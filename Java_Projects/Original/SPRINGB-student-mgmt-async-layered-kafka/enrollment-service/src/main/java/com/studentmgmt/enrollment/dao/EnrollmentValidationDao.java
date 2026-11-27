package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.EnrollmentValidation;

import java.util.Optional;

public interface EnrollmentValidationDao {

    void insertPending(Long enrollmentId);

    Optional<EnrollmentValidation> findById(Long enrollmentId);

    void updateStudentResult(Long enrollmentId, boolean valid, String reason);

    void updateCourseResult(Long enrollmentId, boolean valid, String reason);
}
