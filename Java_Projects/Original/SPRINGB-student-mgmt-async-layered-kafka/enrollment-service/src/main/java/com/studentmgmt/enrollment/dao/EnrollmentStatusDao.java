package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.EnrollmentStatus;

import java.util.List;
import java.util.Optional;

public interface EnrollmentStatusDao {

    List<EnrollmentStatus> findAll();

    Optional<EnrollmentStatus> findById(Long statusId);

    Optional<EnrollmentStatus> findByStatusName(String statusName);
}
