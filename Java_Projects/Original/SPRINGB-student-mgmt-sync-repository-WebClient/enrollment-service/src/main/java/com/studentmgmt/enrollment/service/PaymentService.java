package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.client.NotificationClient;
import com.studentmgmt.enrollment.client.StudentClient;
import com.studentmgmt.enrollment.dto.NotificationSendRequest;
import com.studentmgmt.enrollment.dto.StudentDto;
import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.Payment;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final EnrollmentService enrollmentService;
    private final StudentClient studentClient;
    private final NotificationClient notificationClient;

    public PaymentService(PaymentRepository paymentRepository,
                           EnrollmentService enrollmentService,
                           StudentClient studentClient,
                           NotificationClient notificationClient) {
        this.paymentRepository = paymentRepository;
        this.enrollmentService = enrollmentService;
        this.studentClient = studentClient;
        this.notificationClient = notificationClient;
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

    /**
     * On a successful payment this chains THREE synchronous calls in sequence:
     * confirm the enrollment exists locally, fetch the student's email from
     * student-service, then hand off to notification-service to record and
     * "send" a confirmation — each call blocks until the previous one returns.
     */
    public Payment create(Payment payment) {
        Enrollment enrollment = enrollmentService.findById(payment.getEnrollmentId());
        Payment saved = paymentRepository.save(payment);

        if ("Success".equalsIgnoreCase(saved.getPaymentStatus())) {
            enrollmentService.updateStatusByName(enrollment.getEnrollmentId(), "Active");

            StudentDto student = studentClient.getStudent(enrollment.getStudentId());
            if (student != null && student.getEmail() != null) {
                NotificationSendRequest request = new NotificationSendRequest();
                request.setRecipientId(enrollment.getStudentId());
                request.setChannel("EMAIL");
                request.setSubject("Payment Confirmed");
                request.setMessage("Your payment of " + saved.getAmount()
                        + " for enrollment #" + enrollment.getEnrollmentId() + " was successful.");
                request.setToEmail(student.getEmail());
                notificationClient.send(request);
            }
        }
        return saved;
    }

    public Payment update(Long id, Payment payment) {
        Payment existing = findById(id);
        existing.setEnrollmentId(payment.getEnrollmentId());
        existing.setAmount(payment.getAmount());
        existing.setPaymentMethod(payment.getPaymentMethod());
        existing.setPaymentStatus(payment.getPaymentStatus());
        existing.setTransactionRef(payment.getTransactionRef());
        return paymentRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        paymentRepository.deleteById(id);
    }
}
