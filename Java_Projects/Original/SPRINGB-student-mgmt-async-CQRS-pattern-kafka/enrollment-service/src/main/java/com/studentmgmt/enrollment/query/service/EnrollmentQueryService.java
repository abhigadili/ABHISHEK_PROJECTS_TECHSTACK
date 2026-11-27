package com.studentmgmt.enrollment.query.service;

import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.query.entity.EnrollmentView;
import com.studentmgmt.enrollment.query.repository.EnrollmentQueryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EnrollmentQueryService {

    private final EnrollmentQueryRepository enrollmentQueryRepository;

    public EnrollmentQueryService(EnrollmentQueryRepository enrollmentQueryRepository) {
        this.enrollmentQueryRepository = enrollmentQueryRepository;
    }

    public List<EnrollmentView> findAll(Long studentId, Long courseId) {
        if (studentId != null) {
            return enrollmentQueryRepository.findByStudentId(studentId);
        }
        if (courseId != null) {
            return enrollmentQueryRepository.findByCourseId(courseId);
        }
        return enrollmentQueryRepository.findAll();
    }

    public EnrollmentView findById(Long id) {
        return enrollmentQueryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found: " + id));
    }
}
