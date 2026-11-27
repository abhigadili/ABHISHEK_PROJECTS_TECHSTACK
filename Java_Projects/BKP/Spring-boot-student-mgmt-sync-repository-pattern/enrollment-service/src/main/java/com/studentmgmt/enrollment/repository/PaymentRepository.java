package com.studentmgmt.enrollment.repository;

import com.studentmgmt.enrollment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByEnrollmentId(Long enrollmentId);
}
