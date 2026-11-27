package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.model.Payment;

import java.util.List;

public interface PaymentService {

    List<Payment> findAll(Long enrollmentId);

    Payment findById(Long paymentId);

    Payment create(Payment payment);

    Payment markSuccess(Long paymentId);
}
