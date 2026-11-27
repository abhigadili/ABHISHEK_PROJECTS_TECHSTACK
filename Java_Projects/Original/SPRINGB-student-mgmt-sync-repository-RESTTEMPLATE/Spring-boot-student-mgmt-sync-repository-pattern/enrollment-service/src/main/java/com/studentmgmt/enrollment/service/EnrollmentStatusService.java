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

    public EnrollmentStatus create(EnrollmentStatus status) {
        return enrollmentStatusRepository.save(status);
    }

    public EnrollmentStatus update(Long id, EnrollmentStatus status) {
        EnrollmentStatus existing = findById(id);
        existing.setStatusName(status.getStatusName());
        existing.setDescription(status.getDescription());
        return enrollmentStatusRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        enrollmentStatusRepository.deleteById(id);
    }
}
