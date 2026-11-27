package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.dao.PaymentDao;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.model.Payment;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Payment is a resource local to enrollment-service (no cross-service call
 * involved), so it stays a plain synchronous CRUD flow — only the
 * cross-service validation in EnrollmentSagaService is async-over-Kafka.
 */
@Service
public class PaymentServiceImpl implements PaymentService {

    private final PaymentDao paymentDao;

    public PaymentServiceImpl(PaymentDao paymentDao) {
        this.paymentDao = paymentDao;
    }

    @Override
    public List<Payment> findAll(Long enrollmentId) {
        return enrollmentId != null ? paymentDao.findByEnrollmentId(enrollmentId) : paymentDao.findAll();
    }

    @Override
    public Payment findById(Long paymentId) {
        return paymentDao.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));
    }

    @Override
    public Payment create(Payment payment) {
        return paymentDao.save(payment);
    }

    @Override
    public Payment markSuccess(Long paymentId) {
        findById(paymentId);
        return paymentDao.updateStatus(paymentId, "Success");
    }
}
