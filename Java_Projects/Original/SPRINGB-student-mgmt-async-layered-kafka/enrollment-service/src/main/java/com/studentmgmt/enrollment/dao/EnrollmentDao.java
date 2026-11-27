package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.Enrollment;

import java.util.List;
import java.util.Optional;

public interface EnrollmentDao {

    List<Enrollment> findAll();

    List<Enrollment> findByStudentId(Long studentId);

    List<Enrollment> findByCourseId(Long courseId);

    Optional<Enrollment> findById(Long enrollmentId);

    Enrollment save(Enrollment enrollment);

    Enrollment update(Long enrollmentId, Enrollment enrollment);

    void updateStatus(Long enrollmentId, Long statusId, String rejectionReason);

    void deleteById(Long enrollmentId);
}
