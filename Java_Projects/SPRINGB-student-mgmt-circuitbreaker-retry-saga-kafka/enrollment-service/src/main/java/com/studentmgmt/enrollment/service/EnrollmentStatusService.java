package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.repository.EnrollmentStatusRepository;
import org.springframework.stereotype.Service;

@Service
public class EnrollmentStatusService {

    private final EnrollmentStatusRepository enrollmentStatusRepository;

    public EnrollmentStatusService(EnrollmentStatusRepository enrollmentStatusRepository) {
        this.enrollmentStatusRepository = enrollmentStatusRepository;
    }

    public EnrollmentStatus findByStatusName(String statusName) {
        return enrollmentStatusRepository.findByStatusName(statusName)
                .orElseThrow(() -> new ResourceNotFoundException("Unknown enrollment status: " + statusName));
    }
}
