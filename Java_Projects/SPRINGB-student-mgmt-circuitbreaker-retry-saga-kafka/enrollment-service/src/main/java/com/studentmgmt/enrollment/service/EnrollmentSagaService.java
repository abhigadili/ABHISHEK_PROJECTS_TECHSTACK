package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentValidation;
import com.studentmgmt.enrollment.event.EnrollmentOutcomeEvent;
import com.studentmgmt.enrollment.kafka.EnrollmentOutcomeProducer;
import com.studentmgmt.enrollment.repository.EnrollmentRepository;
import com.studentmgmt.enrollment.repository.EnrollmentValidationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * SAGA PATTERN (choreography style) — owns the distributed-transaction logic
 * that a single ACID database transaction can't provide here, because
 * "is the student valid" and "is the course valid" live in two other
 * services' databases. Each service in the saga reacts to an event and
 * publishes its own event in response; nobody orchestrates the others
 * directly (contrast with an ORCHESTRATION-style saga, where one service
 * would explicitly command the others step by step and track a saga state
 * machine). Here, this service is simply the one that happens to need BOTH
 * replies before it can act — see resolveIfComplete().
 */
@Service
public class EnrollmentSagaService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentSagaService.class);

    private final EnrollmentValidationRepository enrollmentValidationRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentOutcomeProducer enrollmentOutcomeProducer;

    public EnrollmentSagaService(EnrollmentValidationRepository enrollmentValidationRepository,
                                  EnrollmentRepository enrollmentRepository,
                                  EnrollmentStatusService enrollmentStatusService,
                                  EnrollmentOutcomeProducer enrollmentOutcomeProducer) {
        this.enrollmentValidationRepository = enrollmentValidationRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentOutcomeProducer = enrollmentOutcomeProducer;
    }

    /** Called by StudentValidationResultListener when `student.validation.result` arrives. */
    @Transactional
    public void applyStudentValidationResult(Long enrollmentId, boolean valid, String reason) {
        enrollmentValidationRepository.updateStudentResult(enrollmentId, valid, reason);
        EnrollmentValidation validation = enrollmentValidationRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("No Enrollment_Validation row for enrollment " + enrollmentId));
        resolveIfComplete(validation);
    }

    /** Called by CourseValidationResultListener when `course.validation.result` arrives. */
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
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("Enrollment " + enrollmentId + " not found while resolving saga"));

        boolean confirmed = validation.isFullyValid();
        String statusName = confirmed ? "CONFIRMED" : "REJECTED";
        String reason = confirmed ? null : combineReasons(validation);

        enrollment.setStatusId(enrollmentStatusService.findByStatusName(statusName).getStatusId());
        enrollment.setRejectionReason(reason);
        enrollmentRepository.save(enrollment);

        EnrollmentOutcomeEvent outcome = new EnrollmentOutcomeEvent(
                enrollmentId, enrollment.getStudentId(), enrollment.getCourseId(),
                statusName, reason, LocalDateTime.now().toString());

        if (confirmed) {
            enrollmentOutcomeProducer.publishConfirmed(outcome);
        } else {
            enrollmentOutcomeProducer.publishRejected(outcome);
        }

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
