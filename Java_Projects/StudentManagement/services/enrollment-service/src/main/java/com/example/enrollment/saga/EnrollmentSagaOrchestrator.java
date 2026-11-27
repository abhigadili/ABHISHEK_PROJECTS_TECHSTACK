package com.example.enrollment.saga;

import com.example.common.exception.ServiceUnavailableException;
import com.example.enrollment.client.CourseGateway;
import com.example.enrollment.client.RemoteCall;
import com.example.enrollment.client.RemoteDtos.*;
import com.example.enrollment.client.RemoteExceptions.RemoteConflictException;
import com.example.enrollment.client.RemoteExceptions.RemoteNotFoundException;
import com.example.enrollment.client.RemoteExceptions.RemoteRejectedException;
import com.example.enrollment.client.StudentGateway;
import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import com.example.enrollment.entity.SagaInstance;
import com.example.enrollment.entity.SagaState;
import com.example.enrollment.event.EnrollmentEventRecorder;
import com.example.enrollment.repository.EnrollmentRepository;
import com.example.enrollment.repository.SagaInstanceRepository;
import com.example.events.EnrollmentEventType;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Orchestration-based enrollment saga. The state is persisted after EVERY step (sms_saga_instances), remote calls happen outside
 * database transactions, and each step is idempotent, so run(sagaId) can be called again after a crash and continues from the
 * persisted state.
 *
 * <pre>
 * STARTED -> STUDENT_VALIDATED -> COURSE_VALIDATED -> PENDING_CREATED -> SEAT_RESERVED -> COMPLETED
 *     \____________ any failure ____________/                \_ failure _/
 *                           v                                       v
 *                      COMPENSATING (release seat if any, create/mark enrollment REJECTED, publish EnrollmentRejected) -> REJECTED
 * </pre>
 */
@Service
public class EnrollmentSagaOrchestrator {
    private static final Logger log = LoggerFactory.getLogger(EnrollmentSagaOrchestrator.class);

    private final SagaInstanceRepository sagas;
    private final EnrollmentRepository enrollments;
    private final StudentGateway students;
    private final CourseGateway courses;
    private final EnrollmentEventRecorder events;
    private final TransactionTemplate tx;

    public EnrollmentSagaOrchestrator(SagaInstanceRepository sagas, EnrollmentRepository enrollments, StudentGateway students,
                                      CourseGateway courses, EnrollmentEventRecorder events, TransactionTemplate tx) {
        this.sagas = sagas; this.enrollments = enrollments; this.students = students; this.courses = courses; this.events = events; this.tx = tx;
    }

    /** Creates the saga (idempotent on the key), runs it to completion (or pause) and returns the final persisted state. */
    public SagaInstance start(String idempotencyKey, Long studentId, Long courseId, String correlationId) {
        Optional<SagaInstance> existing = sagas.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            log.info("Idempotent replay of enrollment request key={} state={}", idempotencyKey, existing.get().getState());
            return existing.get();
        }
        SagaInstance s = new SagaInstance();
        s.setIdempotencyKey(idempotencyKey);
        s.setStudentId(studentId);
        s.setCourseId(courseId);
        s.setCorrelationId(correlationId);
        try {
            s = sagas.saveAndFlush(s);
        } catch (DataIntegrityViolationException race) {          // concurrent request with the same key
            return sagas.findByIdempotencyKey(idempotencyKey).orElseThrow();
        }
        return run(s.getSagaId());
    }

    /** Drives the saga until it is terminal or paused. Safe to call repeatedly. */
    public SagaInstance run(Long sagaId) {
        SagaInstance s = sagas.findById(sagaId).orElseThrow();
        for (int guard = 0; !s.getState().isTerminal() && guard < 12; guard++) {
            try {
                s = step(s);
            } catch (SagaPausedException paused) {
                log.warn("Saga {} paused in {}: {}", sagaId, s.getState(), paused.getMessage());
                return save(s, x -> x.setAttempts(x.getAttempts() + 1));
            }
        }
        return s;
    }

    private SagaInstance step(SagaInstance s) {
        log.info("Saga {} step {} (enrollment={}, student={}, course={})", s.getSagaId(), s.getState(), s.getEnrollmentId(), s.getStudentId(), s.getCourseId());
        return switch (s.getState()) {
            case STARTED -> validateStudent(s);
            case STUDENT_VALIDATED -> validateCourse(s);
            case COURSE_VALIDATED -> createPendingEnrollment(s);
            case PENDING_CREATED -> reserveSeat(s);
            case SEAT_RESERVED -> confirm(s);
            case COMPENSATING -> compensate(s);
            case COMPLETED, REJECTED -> s;
        };
    }

    // ---- step 2: validate student through Student Service ------------------------------------------------------------
    private SagaInstance validateStudent(SagaInstance s) {
        try {
            EligibilityInfo eligibility = RemoteCall.await(students.eligibility(s.getStudentId()), "student-service");
            if (!eligibility.eligible()) return fail(s, "Student is not eligible: " + eligibility.reason());
            StudentInfo info = RemoteCall.await(students.getStudent(s.getStudentId()), "student-service");
            return save(s, x -> { x.setStudentName(info.fullName()); x.setStudentEmail(info.email()); x.setState(SagaState.STUDENT_VALIDATED); });
        } catch (RemoteNotFoundException e) {
            return fail(s, "Student " + s.getStudentId() + " does not exist");
        } catch (RemoteRejectedException | RemoteConflictException | ServiceUnavailableException e) {
            return fail(s, "Student validation failed: " + e.getMessage());
        }
    }

    // ---- step 3: validate course through Course Service --------------------------------------------------------------
    private SagaInstance validateCourse(SagaInstance s) {
        try {
            CourseInfo course = RemoteCall.await(courses.getCourse(s.getCourseId()), "course-service");
            if (!"ACTIVE".equals(course.status())) return fail(s, "Course " + s.getCourseId() + " is not active");
            AvailabilityInfo availability = RemoteCall.await(courses.availability(s.getCourseId()), "course-service");
            if (!availability.available()) return fail(s, "No seats available in course " + s.getCourseId());
            return save(s, x -> { x.setCourseName(course.courseName()); x.setState(SagaState.COURSE_VALIDATED); });
        } catch (RemoteNotFoundException e) {
            return fail(s, "Course " + s.getCourseId() + " does not exist");
        } catch (RemoteRejectedException | RemoteConflictException | ServiceUnavailableException e) {
            return fail(s, "Course validation failed: " + e.getMessage());
        }
    }

    // ---- step 4: PENDING enrollment + EnrollmentRequested in ONE local transaction (outbox) ---------------------------
    private SagaInstance createPendingEnrollment(SagaInstance s) {
        try {
            return tx.execute(status -> {
                Enrollment e = enrollments.findByIdempotencyKey(s.getIdempotencyKey()).orElseGet(() -> {
                    Enrollment n = new Enrollment();
                    n.setStudentId(s.getStudentId());
                    n.setCourseId(s.getCourseId());
                    n.setStudentName(s.getStudentName());
                    n.setStudentEmail(s.getStudentEmail());
                    n.setCourseName(s.getCourseName());
                    n.setStatus(EnrollmentStatus.PENDING);
                    n.setIdempotencyKey(s.getIdempotencyKey());
                    n = enrollments.saveAndFlush(n);              // unique(active_key) -> duplicate active enrollment fails here
                    events.record(EnrollmentEventType.EnrollmentRequested, n, null, s.getCorrelationId());
                    return n;
                });
                s.setEnrollmentId(e.getEnrollmentId());
                s.setState(SagaState.PENDING_CREATED);
                return sagas.saveAndFlush(s);
            });
        } catch (DataIntegrityViolationException dup) {
            return fail(s, "Student " + s.getStudentId() + " already has an active enrollment in course " + s.getCourseId());
        }
    }

    // ---- step 5: reserve a seat (idempotent per enrollmentId in Course Service) --------------------------------------
    private SagaInstance reserveSeat(SagaInstance s) {
        try {
            RemoteCall.await(courses.reserveSeat(s.getCourseId(), s.getEnrollmentId()), "course-service");
            return save(s, x -> { x.setSeatReserved(true); x.setState(SagaState.SEAT_RESERVED); });
        } catch (RemoteConflictException e) {
            return fail(s, "Seat reservation failed: no seats available");
        } catch (RemoteNotFoundException | RemoteRejectedException | ServiceUnavailableException e) {
            return fail(s, "Seat reservation failed: " + e.getMessage());
        }
    }

    // ---- steps 6/7: confirm + EnrollmentConfirmed in ONE local transaction -------------------------------------------
    private SagaInstance confirm(SagaInstance s) {
        try {
            return tx.execute(status -> {
                Enrollment e = enrollments.findById(s.getEnrollmentId()).orElseThrow();
                if (e.getStatus() == EnrollmentStatus.PENDING) {
                    e.transitionTo(EnrollmentStatus.CONFIRMED);
                    enrollments.saveAndFlush(e);
                    events.record(EnrollmentEventType.EnrollmentConfirmed, e, null, s.getCorrelationId());
                }
                s.setState(SagaState.COMPLETED);
                return sagas.saveAndFlush(s);
            });
        } catch (RuntimeException ex) {
            log.error("Saga {} could not confirm enrollment {}: {}", s.getSagaId(), s.getEnrollmentId(), ex.toString());
            return fail(s, "Enrollment could not be confirmed: " + ex.getMessage());   // seat is released by compensate()
        }
    }

    // ---- compensation ----------------------------------------------------------------------------------------------
    private SagaInstance fail(SagaInstance s, String reason) {
        log.warn("Saga {} failed in {}: {}", s.getSagaId(), s.getState(), reason);
        return save(s, x -> { x.setFailureReason(truncate(reason)); x.setState(SagaState.COMPENSATING); });
    }

    private SagaInstance compensate(SagaInstance s) {
        if (s.getEnrollmentId() != null) {
            try {   // release is idempotent: a no-op when no seat was reserved
                RemoteCall.await(courses.releaseSeat(s.getCourseId(), s.getEnrollmentId()), "course-service");
            } catch (RemoteNotFoundException | RemoteConflictException | RemoteRejectedException ignored) {
                // nothing to release
            } catch (ServiceUnavailableException e) {
                throw new SagaPausedException("seat release pending, course-service unavailable", e);   // retried by SagaRecoveryJob
            }
        }
        return tx.execute(status -> {
            Enrollment e = s.getEnrollmentId() == null ? null : enrollments.findById(s.getEnrollmentId()).orElse(null);
            if (e == null) {
                e = new Enrollment();
                e.setStudentId(s.getStudentId());
                e.setCourseId(s.getCourseId());
                e.setStudentName(s.getStudentName());
                e.setStudentEmail(s.getStudentEmail());
                e.setCourseName(s.getCourseName());
                e.setStatus(EnrollmentStatus.REJECTED);
                e.setIdempotencyKey(s.getIdempotencyKey());
                e.setRemarks(s.getFailureReason());
                e = enrollments.saveAndFlush(e);
                events.record(EnrollmentEventType.EnrollmentRejected, e, s.getFailureReason(), s.getCorrelationId());
            } else if (e.getStatus() == EnrollmentStatus.PENDING) {
                e.transitionTo(EnrollmentStatus.REJECTED);
                e.setRemarks(s.getFailureReason());
                enrollments.saveAndFlush(e);
                events.record(EnrollmentEventType.EnrollmentRejected, e, s.getFailureReason(), s.getCorrelationId());
            }
            s.setEnrollmentId(e.getEnrollmentId());
            s.setSeatReserved(false);
            s.setState(SagaState.REJECTED);
            return sagas.saveAndFlush(s);
        });
    }

    private SagaInstance save(SagaInstance s, java.util.function.Consumer<SagaInstance> change) {
        change.accept(s);
        return sagas.saveAndFlush(s);
    }

    private static String truncate(String s) { return s == null ? null : s.substring(0, Math.min(500, s.length())); }
}
