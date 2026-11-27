package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.model.EnrollmentStatus;

import java.util.List;

public interface EnrollmentStatusService {

    List<EnrollmentStatus> findAll();

    EnrollmentStatus findById(Long statusId);

    EnrollmentStatus findByStatusName(String statusName);
}
