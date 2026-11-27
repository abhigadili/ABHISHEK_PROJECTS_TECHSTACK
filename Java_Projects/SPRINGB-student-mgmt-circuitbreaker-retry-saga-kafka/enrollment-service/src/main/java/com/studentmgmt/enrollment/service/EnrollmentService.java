package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentValidation;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.kafka.EnrollmentRequestedProducer;
import com.studentmgmt.enrollment.repository.EnrollmentRepository;
import com.studentmgmt.enrollment.repository.EnrollmentValidationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * create() is where the Saga BEGINS: an Enrollment row is written immediately
 * in PENDING_VALIDATION status (the client gets a fast, definite answer that
 * their request was accepted), then `enrollment.requested` is published so
 * student-service and course-service can validate asynchronously. Whether
 * this enrollment ends up CONFIRMED or REJECTED is decided later, entirely
 * out-of-band, by EnrollmentSagaService.
 */
@Service
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentValidationRepository enrollmentValidationRepository;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentRequestedProducer enrollmentRequestedProducer;

    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                              EnrollmentValidationRepository enrollmentValidationRepository,
                              EnrollmentStatusService enrollmentStatusService,
                              EnrollmentRequestedProducer enrollmentRequestedProducer) {
        this.enrollmentRepository = enrollmentRepository;
        this.enrollmentValidationRepository = enrollmentValidationRepository;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentRequestedProducer = enrollmentRequestedProducer;
    }

    public List<Enrollment> findAll() {
        return enrollmentRepository.findAll();
    }

    public Enrollment findById(Long id) {
        return enrollmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + id));
    }

    @Transactional
    public Enrollment create(Enrollment enrollment) {
        enrollment.setEnrollmentId(null);
        enrollment.setStatusId(enrollmentStatusService.findByStatusName("PENDING_VALIDATION").getStatusId());
        Enrollment saved = enrollmentRepository.save(enrollment);

        EnrollmentValidation validation = new EnrollmentValidation();
        validation.setEnrollmentId(saved.getEnrollmentId());
        enrollmentValidationRepository.save(validation);

        enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(
                saved.getEnrollmentId(), saved.getStudentId(), saved.getCourseId(), LocalDateTime.now().toString()));

        return saved;
    }

    public Enrollment update(Long id, Enrollment update) {
        Enrollment existing = findById(id);
        existing.setStatusId(update.getStatusId());
        existing.setRejectionReason(update.getRejectionReason());
        return enrollmentRepository.save(existing);
    }

    public void delete(Long id) {
        if (!enrollmentRepository.existsById(id)) {
            throw new ResourceNotFoundException("Enrollment not found with id: " + id);
        }
        enrollmentRepository.deleteById(id);
    }
}
