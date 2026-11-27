package com.studentmgmt.enrollment.repository;

import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnrollmentStatusRepository extends JpaRepository<EnrollmentStatus, Long> {
    Optional<EnrollmentStatus> findByStatusName(String statusName);
}
