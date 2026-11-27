package com.example.enrollment.command;

import com.example.common.exception.BusinessRuleException;
import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.enrollment.client.CourseGateway;
import com.example.enrollment.client.RemoteCall;
import com.example.enrollment.client.RemoteExceptions.RemoteConflictException;
import com.example.enrollment.client.RemoteExceptions.RemoteNotFoundException;
import com.example.enrollment.dto.EnrollmentResponse;
import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import com.example.enrollment.event.EnrollmentEventRecorder;
import com.example.enrollment.repository.EnrollmentRepository;
import com.example.events.EnrollmentEventType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Cancels a CONFIRMED enrollment: (1) releases the seat in Course Service (idempotent), then (2) in one local transaction marks it
 * CANCELLED and stores EnrollmentCancelled in the outbox. If step 1 fails nothing changes and the caller may simply retry.
 */
@Component
public class CancelEnrollmentCommandHandler {
    private static final Logger log = LoggerFactory.getLogger(CancelEnrollmentCommandHandler.class);
    private final EnrollmentRepository enrollments;
    private final CourseGateway courses;
    private final EnrollmentEventRecorder events;
    private final TransactionTemplate tx;

    public CancelEnrollmentCommandHandler(EnrollmentRepository enrollments, CourseGateway courses, EnrollmentEventRecorder events, TransactionTemplate tx) {
        this.enrollments = enrollments; this.courses = courses; this.events = events; this.tx = tx;
    }

    public EnrollmentResponse handle(CancelEnrollmentCommand cmd) {
        Enrollment e = enrollments.findById(cmd.enrollmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment " + cmd.enrollmentId() + " not found"));
        if (e.getStatus() == EnrollmentStatus.PENDING) throw new ConflictException("Enrollment " + e.getEnrollmentId() + " is still being processed; retry shortly");
        if (e.getStatus() != EnrollmentStatus.CONFIRMED) throw new BusinessRuleException("Only CONFIRMED enrollments can be cancelled (current: " + e.getStatus() + ")");

        try {
            RemoteCall.await(courses.releaseSeat(e.getCourseId(), e.getEnrollmentId()), "course-service");
        } catch (RemoteNotFoundException | RemoteConflictException ignored) {
            log.warn("Seat release for enrollment {} reported nothing to release", e.getEnrollmentId());
        }
        return tx.execute(status -> {
            Enrollment fresh = enrollments.findById(cmd.enrollmentId()).orElseThrow();
            fresh.transitionTo(EnrollmentStatus.CANCELLED);
            if (cmd.reason() != null) fresh.setRemarks(cmd.reason());
            enrollments.saveAndFlush(fresh);
            events.record(EnrollmentEventType.EnrollmentCancelled, fresh, cmd.reason(), null);
            log.info("Enrollment {} cancelled", fresh.getEnrollmentId());
            return EnrollmentResponse.from(fresh);
        });
    }
}
