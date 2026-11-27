package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.Payment;

import java.util.List;
import java.util.Optional;

public interface PaymentDao {

    List<Payment> findAll();

    List<Payment> findByEnrollmentId(Long enrollmentId);

    Optional<Payment> findById(Long paymentId);

    Payment save(Payment payment);

    Payment updateStatus(Long paymentId, String status);
}
