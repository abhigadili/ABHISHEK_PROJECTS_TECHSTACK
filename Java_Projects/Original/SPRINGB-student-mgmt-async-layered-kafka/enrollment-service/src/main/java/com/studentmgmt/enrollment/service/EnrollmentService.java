package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.model.Enrollment;

import java.util.List;

public interface EnrollmentService {

    List<Enrollment> findAll(Long studentId, Long courseId);

    Enrollment findById(Long id);

    /**
     * Inserts the Enrollment row as PENDING_VALIDATION and publishes
     * `enrollment.requested` — does NOT wait for student-service/course-service
     * to reply. The returned Enrollment is only "provisionally" created; poll
     * findById(id) to observe it move to CONFIRMED or REJECTED.
     */
    Enrollment create(Enrollment enrollment);

    Enrollment update(Long id, Enrollment enrollment);

    void delete(Long id);
}
