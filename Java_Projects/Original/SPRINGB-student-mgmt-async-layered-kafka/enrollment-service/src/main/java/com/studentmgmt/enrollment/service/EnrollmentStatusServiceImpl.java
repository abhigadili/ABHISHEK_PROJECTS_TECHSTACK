package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.dao.EnrollmentStatusDao;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.model.EnrollmentStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EnrollmentStatusServiceImpl implements EnrollmentStatusService {

    private final EnrollmentStatusDao enrollmentStatusDao;

    public EnrollmentStatusServiceImpl(EnrollmentStatusDao enrollmentStatusDao) {
        this.enrollmentStatusDao = enrollmentStatusDao;
    }

    @Override
    public List<EnrollmentStatus> findAll() {
        return enrollmentStatusDao.findAll();
    }

    @Override
    public EnrollmentStatus findById(Long statusId) {
        return enrollmentStatusDao.findById(statusId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment status not found: " + statusId));
    }

    @Override
    public EnrollmentStatus findByStatusName(String statusName) {
        return enrollmentStatusDao.findByStatusName(statusName)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment_Status '" + statusName + "' seed row is missing"));
    }
}
