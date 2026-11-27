package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.repository.EnrollmentStatusRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EnrollmentStatusService {

    private final EnrollmentStatusRepository enrollmentStatusRepository;

    public EnrollmentStatusService(EnrollmentStatusRepository enrollmentStatusRepository) {
        this.enrollmentStatusRepository = enrollmentStatusRepository;
    }

    public List<EnrollmentStatus> findAll() {
        return enrollmentStatusRepository.findAll();
    }

    public EnrollmentStatus findById(Long id) {
        return enrollmentStatusRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment status not found: " + id));
    }

    public EnrollmentStatus findByStatusName(String statusName) {
        return enrollmentStatusRepository.findByStatusName(statusName)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment_Status '" + statusName + "' seed row is missing"));
    }
}
