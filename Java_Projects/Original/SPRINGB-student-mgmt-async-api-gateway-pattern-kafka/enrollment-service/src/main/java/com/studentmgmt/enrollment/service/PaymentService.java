package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.Payment;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Payment is a resource local to enrollment-service (no cross-service call
 * involved), so it stays a plain synchronous CRUD flow — only the
 * cross-service validation in EnrollmentSagaService is async-over-Kafka.
 * Unlike the sync/OpenFeign version of this system, a successful payment
 * does NOT trigger a synchronous call to notification-service.
 */
@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;

    public PaymentService(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public List<Payment> findAll(Long enrollmentId) {
        if (enrollmentId != null) {
            return paymentRepository.findByEnrollmentId(enrollmentId);
        }
        return paymentRepository.findAll();
    }

    public Payment findById(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + id));
    }

    public Payment create(Payment payment) {
        return paymentRepository.save(payment);
    }

    public Payment markSuccess(Long id) {
        Payment existing = findById(id);
        existing.setPaymentStatus("Success");
        return paymentRepository.save(existing);
    }
}
