package com.studentmgmt.enrollment.command.service;

import com.studentmgmt.enrollment.command.entity.Enrollment;
import com.studentmgmt.enrollment.command.entity.EnrollmentValidation;
import com.studentmgmt.enrollment.command.repository.EnrollmentCommandRepository;
import com.studentmgmt.enrollment.command.repository.EnrollmentValidationRepository;
import com.studentmgmt.enrollment.event.EnrollmentChangedEvent;
import com.studentmgmt.enrollment.event.EnrollmentOutcomeEvent;
import com.studentmgmt.enrollment.kafka.EnrollmentChangedProducer;
import com.studentmgmt.enrollment.kafka.EnrollmentOutcomeProducer;
import com.studentmgmt.enrollment.service.EnrollmentStatusService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Owns the choreography saga that replaces synchronous cross-service calls:
 * once BOTH student.validation.result and course.validation.result have
 * arrived for an enrollment, this decides CONFIRMED vs REJECTED, updates the
 * write model, and publishes two different things — EnrollmentOutcomeEvent
 * (cross-service signal for notification-service) and EnrollmentChangedEvent
 * (this service's own CQRS projection signal for Enrollments_View).
 */
@Service
public class EnrollmentSagaService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentSagaService.class);

    private final EnrollmentValidationRepository enrollmentValidationRepository;
    private final EnrollmentCommandRepository enrollmentCommandRepository;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentOutcomeProducer enrollmentOutcomeProducer;
    private final EnrollmentChangedProducer enrollmentChangedProducer;

    public EnrollmentSagaService(EnrollmentValidationRepository enrollmentValidationRepository,
                                  EnrollmentCommandRepository enrollmentCommandRepository,
                                  EnrollmentStatusService enrollmentStatusService,
                                  EnrollmentOutcomeProducer enrollmentOutcomeProducer,
                                  EnrollmentChangedProducer enrollmentChangedProducer) {
        this.enrollmentValidationRepository = enrollmentValidationRepository;
        this.enrollmentCommandRepository = enrollmentCommandRepository;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentOutcomeProducer = enrollmentOutcomeProducer;
        this.enrollmentChangedProducer = enrollmentChangedProducer;
    }

    /** Called by the Kafka listener for `student.validation.result`. */
    @Transactional
    public void applyStudentValidationResult(Long enrollmentId, boolean valid, String reason) {
        enrollmentValidationRepository.updateStudentResult(enrollmentId, valid, reason);
        EnrollmentValidation validation = enrollmentValidationRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("No Enrollment_Validation row for enrollment " + enrollmentId));
        resolveIfComplete(validation);
    }

    /** Called by the Kafka listener for `course.validation.result`. */
    @Transactional
    public void applyCourseValidationResult(Long enrollmentId, boolean valid, String reason) {
        enrollmentValidationRepository.updateCourseResult(enrollmentId, valid, reason);
        EnrollmentValidation validation = enrollmentValidationRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("No Enrollment_Validation row for enrollment " + enrollmentId));
        resolveIfComplete(validation);
    }

    private void resolveIfComplete(EnrollmentValidation validation) {
        if (!validation.isResolved()) {
            log.info("Enrollment {} still waiting on the other validation reply (student={}, course={})",
                    validation.getEnrollmentId(), validation.getStudentValid(), validation.getCourseValid());
            return;
        }

        Long enrollmentId = validation.getEnrollmentId();
        Enrollment enrollment = enrollmentCommandRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("Enrollment " + enrollmentId + " not found while resolving saga"));

        boolean confirmed = validation.isFullyValid();
        String statusName = confirmed ? "CONFIRMED" : "REJECTED";
        String reason = confirmed ? null : combineReasons(validation);

        enrollment.setStatusId(enrollmentStatusService.findByStatusName(statusName).getStatusId());
        enrollment.setRejectionReason(reason);
        enrollmentCommandRepository.save(enrollment);

        String now = LocalDateTime.now().toString();

        EnrollmentOutcomeEvent outcome = new EnrollmentOutcomeEvent(
                enrollmentId, enrollment.getStudentId(), enrollment.getCourseId(), statusName, reason, now);
        if (confirmed) {
            enrollmentOutcomeProducer.publishConfirmed(outcome);
        } else {
            enrollmentOutcomeProducer.publishRejected(outcome);
        }

        EnrollmentChangedEvent changed = new EnrollmentChangedEvent();
        changed.setOperation(EnrollmentChangedEvent.UPDATED);
        changed.setEnrollmentId(enrollmentId);
        changed.setStudentId(enrollment.getStudentId());
        changed.setCourseId(enrollment.getCourseId());
        changed.setStatusId(enrollment.getStatusId());
        changed.setStatusName(statusName);
        changed.setEnrollmentDate(enrollment.getEnrollmentDate() != null ? enrollment.getEnrollmentDate().toString() : null);
        changed.setRejectionReason(reason);
        enrollmentChangedProducer.publish(changed);

        log.info("Enrollment {} resolved to {}", enrollmentId, statusName);
    }

    private String combineReasons(EnrollmentValidation validation) {
        StringBuilder sb = new StringBuilder();
        if (!Boolean.TRUE.equals(validation.getStudentValid())) {
            sb.append(validation.getStudentReason());
        }
        if (!Boolean.TRUE.equals(validation.getCourseValid())) {
            if (sb.length() > 0) {
                sb.append("; ");
            }
            sb.append(validation.getCourseReason());
        }
        return sb.toString();
    }
}
