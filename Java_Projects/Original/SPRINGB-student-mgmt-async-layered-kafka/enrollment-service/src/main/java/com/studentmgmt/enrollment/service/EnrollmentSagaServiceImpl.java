package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.dao.EnrollmentDao;
import com.studentmgmt.enrollment.dao.EnrollmentValidationDao;
import com.studentmgmt.enrollment.event.EnrollmentOutcomeEvent;
import com.studentmgmt.enrollment.kafka.EnrollmentOutcomeProducer;
import com.studentmgmt.enrollment.model.Enrollment;
import com.studentmgmt.enrollment.model.EnrollmentValidation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Owns the choreography saga that replaces the old synchronous
 * StudentFeignClient/CourseFeignClient calls: once BOTH
 * student.validation.result and course.validation.result have arrived for
 * an enrollment, this decides CONFIRMED vs REJECTED and publishes the
 * matching outcome event for notification-service to react to.
 */
@Service
public class EnrollmentSagaServiceImpl implements EnrollmentSagaService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentSagaServiceImpl.class);

    private final EnrollmentValidationDao enrollmentValidationDao;
    private final EnrollmentDao enrollmentDao;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentOutcomeProducer enrollmentOutcomeProducer;

    public EnrollmentSagaServiceImpl(EnrollmentValidationDao enrollmentValidationDao,
                                      EnrollmentDao enrollmentDao,
                                      EnrollmentStatusService enrollmentStatusService,
                                      EnrollmentOutcomeProducer enrollmentOutcomeProducer) {
        this.enrollmentValidationDao = enrollmentValidationDao;
        this.enrollmentDao = enrollmentDao;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentOutcomeProducer = enrollmentOutcomeProducer;
    }

    @Override
    public void applyStudentValidationResult(Long enrollmentId, boolean valid, String reason) {
        enrollmentValidationDao.updateStudentResult(enrollmentId, valid, reason);
        resolveIfComplete(enrollmentId);
    }

    @Override
    public void applyCourseValidationResult(Long enrollmentId, boolean valid, String reason) {
        enrollmentValidationDao.updateCourseResult(enrollmentId, valid, reason);
        resolveIfComplete(enrollmentId);
    }

    private void resolveIfComplete(Long enrollmentId) {
        EnrollmentValidation validation = enrollmentValidationDao.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("No Enrollment_Validation row for enrollment " + enrollmentId));

        if (!validation.isResolved()) {
            log.info("Enrollment {} still waiting on the other validation reply (student={}, course={})",
                    enrollmentId, validation.getStudentValid(), validation.getCourseValid());
            return;
        }

        Enrollment enrollment = enrollmentDao.findById(enrollmentId)
                .orElseThrow(() -> new IllegalStateException("Enrollment " + enrollmentId + " not found while resolving saga"));

        boolean confirmed = validation.isFullyValid();
        String statusName = confirmed ? "CONFIRMED" : "REJECTED";
        String reason = confirmed ? null : combineReasons(validation);

        Long statusId = enrollmentStatusService.findByStatusName(statusName).getStatusId();
        enrollmentDao.updateStatus(enrollmentId, statusId, reason);

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
