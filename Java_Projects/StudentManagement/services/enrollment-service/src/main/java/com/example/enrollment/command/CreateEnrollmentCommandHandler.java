package com.example.enrollment.command;

import com.example.common.exception.ConflictException;
import com.example.enrollment.dto.EnrollmentResponse;
import com.example.enrollment.entity.EnrollmentStatus;
import com.example.enrollment.entity.SagaInstance;
import com.example.enrollment.entity.SagaState;
import com.example.enrollment.repository.EnrollmentRepository;
import com.example.enrollment.repository.SagaInstanceRepository;
import com.example.enrollment.saga.EnrollmentSagaOrchestrator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CreateEnrollmentCommandHandler {
    private final EnrollmentSagaOrchestrator saga;
    private final SagaInstanceRepository sagas;
    private final EnrollmentRepository enrollments;

    public CreateEnrollmentCommandHandler(EnrollmentSagaOrchestrator saga, SagaInstanceRepository sagas, EnrollmentRepository enrollments) {
        this.saga = saga; this.sagas = sagas; this.enrollments = enrollments;
    }

    public EnrollmentOutcome handle(CreateEnrollmentCommand cmd) {
        // Replays of the same idempotency key skip the duplicate check and return the stored result.
        if (sagas.findByIdempotencyKey(cmd.idempotencyKey()).isEmpty()
                && enrollments.existsByStudentIdAndCourseIdAndStatusIn(cmd.studentId(), cmd.courseId(),
                List.of(EnrollmentStatus.PENDING, EnrollmentStatus.CONFIRMED))) {
            throw new ConflictException("Student " + cmd.studentId() + " already has an active enrollment in course " + cmd.courseId());
        }
        SagaInstance s = saga.start(cmd.idempotencyKey(), cmd.studentId(), cmd.courseId(), cmd.correlationId());
        EnrollmentResponse e = s.getEnrollmentId() == null ? null
                : enrollments.findById(s.getEnrollmentId()).map(EnrollmentResponse::from).orElse(null);
        if (s.getState() == SagaState.COMPLETED) return new EnrollmentOutcome(EnrollmentOutcome.CONFIRMED, "Enrollment confirmed", e);
        if (s.getState() == SagaState.REJECTED) return new EnrollmentOutcome(EnrollmentOutcome.REJECTED, s.getFailureReason(), e);
        return new EnrollmentOutcome(EnrollmentOutcome.IN_PROGRESS, "Enrollment is being processed (state " + s.getState() + ")", e);
    }
}
