package com.example.enrollment.saga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.example.common.exception.ServiceUnavailableException;
import com.example.enrollment.client.CourseGateway;
import com.example.enrollment.client.RemoteDtos.*;
import com.example.enrollment.client.RemoteExceptions.*;
import com.example.enrollment.client.StudentGateway;
import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import com.example.enrollment.entity.SagaInstance;
import com.example.enrollment.entity.SagaState;
import com.example.enrollment.event.EnrollmentEventRecorder;
import com.example.enrollment.repository.EnrollmentRepository;
import com.example.enrollment.repository.SagaInstanceRepository;
import com.example.events.EnrollmentEventType;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Pure unit tests of the saga logic: repositories and remote gateways are mocked, state is kept in an in-memory map. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EnrollmentSagaOrchestratorTest {
    @Mock SagaInstanceRepository sagas;
    @Mock EnrollmentRepository enrollments;
    @Mock StudentGateway students;
    @Mock CourseGateway courses;
    @Mock EnrollmentEventRecorder events;
    @Mock PlatformTransactionManager txManager;

    EnrollmentSagaOrchestrator orchestrator;
    final Map<Long, Enrollment> db = new HashMap<>();
    final Map<Long, SagaInstance> sagaDb = new HashMap<>();
    long nextEnrollmentId = 10;

    @BeforeEach
    void setUp() {
        orchestrator = new EnrollmentSagaOrchestrator(sagas, enrollments, students, courses, events, new TransactionTemplate(txManager));
        when(sagas.saveAndFlush(any(SagaInstance.class))).thenAnswer(i -> {
            SagaInstance s = i.getArgument(0);
            if (s.getSagaId() == null) s.setSagaId(1L);
            sagaDb.put(s.getSagaId(), s);
            return s;
        });
        when(sagas.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(sagaDb.get(i.getArgument(0))));
        when(sagas.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(enrollments.findByIdempotencyKey(any())).thenReturn(Optional.empty());
        when(enrollments.saveAndFlush(any(Enrollment.class))).thenAnswer(i -> {
            Enrollment e = i.getArgument(0);
            if (e.getEnrollmentId() == null) e.setEnrollmentId(nextEnrollmentId++);
            db.put(e.getEnrollmentId(), e);
            return e;
        });
        when(enrollments.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(db.get(i.getArgument(0))));

        // default remote behaviour: everything healthy
        when(students.eligibility(1L)).thenReturn(CompletableFuture.completedFuture(new EligibilityInfo(1L, true, null)));
        when(students.getStudent(1L)).thenReturn(CompletableFuture.completedFuture(new StudentInfo(1L, "Asha", "Rao", "asha@example.com", "ACTIVE")));
        when(courses.getCourse(2L)).thenReturn(CompletableFuture.completedFuture(new CourseInfo(2L, "Java", "JMS-101", "ACTIVE", 10, 5)));
        when(courses.availability(2L)).thenReturn(CompletableFuture.completedFuture(new AvailabilityInfo(2L, "ACTIVE", 10, 5, true)));
        when(courses.reserveSeat(eq(2L), anyLong())).thenReturn(CompletableFuture.completedFuture(new SeatResult(2L, 10L, "RESERVED", 4, false)));
        when(courses.releaseSeat(eq(2L), anyLong())).thenReturn(CompletableFuture.completedFuture(new SeatResult(2L, 10L, "RELEASED", 5, false)));
    }

    private static <T> CompletableFuture<T> failed(Throwable t) { return CompletableFuture.failedFuture(t); }

    private SagaInstance start() { return orchestrator.start("key-1", 1L, 2L, "corr-1"); }

    @Test
    void happyPathConfirmsEnrollmentAndPublishesRequestedThenConfirmed() {
        SagaInstance s = start();

        assertThat(s.getState()).isEqualTo(SagaState.COMPLETED);
        assertThat(db.get(10L).getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
        assertThat(db.get(10L).getStudentName()).isEqualTo("Asha Rao");
        InOrder order = inOrder(students, courses, events);
        order.verify(students).eligibility(1L);
        order.verify(courses).getCourse(2L);
        order.verify(events).record(eq(EnrollmentEventType.EnrollmentRequested), any(), any(), eq("corr-1"));
        order.verify(courses).reserveSeat(2L, 10L);
        order.verify(events).record(eq(EnrollmentEventType.EnrollmentConfirmed), any(), any(), eq("corr-1"));
        verify(courses, never()).releaseSeat(anyLong(), anyLong());
    }

    @Test
    void unknownStudentIsRejectedWithoutTouchingCourseServiceAndAnEventIsPublished() {
        when(students.eligibility(1L)).thenReturn(failed(new RemoteNotFoundException("404")));

        SagaInstance s = start();

        assertThat(s.getState()).isEqualTo(SagaState.REJECTED);
        assertThat(s.getFailureReason()).contains("does not exist");
        verifyNoInteractions(courses);
        Enrollment e = db.get(s.getEnrollmentId());
        assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.REJECTED);
        verify(events).record(eq(EnrollmentEventType.EnrollmentRejected), eq(e), contains("does not exist"), any());
        verify(events, never()).record(eq(EnrollmentEventType.EnrollmentRequested), any(), any(), any());
    }

    @Test
    void ineligibleStudentIsRejected() {
        when(students.eligibility(1L)).thenReturn(CompletableFuture.completedFuture(new EligibilityInfo(1L, false, "Student is INACTIVE")));
        SagaInstance s = start();
        assertThat(s.getState()).isEqualTo(SagaState.REJECTED);
        assertThat(s.getFailureReason()).contains("INACTIVE");
    }

    @Test
    void inactiveOrFullOrMissingCourseIsRejectedBeforeAnySeatIsReserved() {
        when(courses.getCourse(2L)).thenReturn(CompletableFuture.completedFuture(new CourseInfo(2L, "Java", "JMS-101", "INACTIVE", 10, 5)));
        assertThat(start().getFailureReason()).contains("not active");

        sagaDb.clear(); db.clear();
        when(courses.getCourse(2L)).thenReturn(CompletableFuture.completedFuture(new CourseInfo(2L, "Java", "JMS-101", "ACTIVE", 10, 0)));
        when(courses.availability(2L)).thenReturn(CompletableFuture.completedFuture(new AvailabilityInfo(2L, "ACTIVE", 10, 0, false)));
        assertThat(orchestrator.start("key-2", 1L, 2L, null).getFailureReason()).contains("No seats");

        sagaDb.clear(); db.clear();
        when(courses.getCourse(2L)).thenReturn(failed(new RemoteNotFoundException("404")));
        assertThat(orchestrator.start("key-3", 1L, 2L, null).getFailureReason()).contains("does not exist");
        verify(courses, never()).reserveSeat(anyLong(), anyLong());
    }

    @Test
    void seatReservationConflictRejectsAndRunsTheCompensatingRelease() {
        when(courses.reserveSeat(eq(2L), anyLong())).thenReturn(failed(new RemoteConflictException("409")));

        SagaInstance s = start();

        assertThat(s.getState()).isEqualTo(SagaState.REJECTED);
        assertThat(s.isSeatReserved()).isFalse();
        verify(courses).releaseSeat(2L, 10L);                         // idempotent compensation
        assertThat(db.get(10L).getStatus()).isEqualTo(EnrollmentStatus.REJECTED);
        verify(events).record(eq(EnrollmentEventType.EnrollmentRequested), any(), any(), any());
        verify(events).record(eq(EnrollmentEventType.EnrollmentRejected), any(), contains("no seats"), any());
        verify(events, never()).record(eq(EnrollmentEventType.EnrollmentConfirmed), any(), any(), any());
    }

    @Test
    void failureAfterSeatReservationReleasesTheSeat() {
        // confirm step: the first findById (inside the confirm transaction) blows up, compensation then reads normally
        Enrollment[] holder = new Enrollment[1];
        when(enrollments.saveAndFlush(any(Enrollment.class))).thenAnswer(i -> {
            Enrollment e = i.getArgument(0);
            if (e.getEnrollmentId() == null) e.setEnrollmentId(nextEnrollmentId++);
            db.put(e.getEnrollmentId(), e);
            holder[0] = e;
            return e;
        });
        when(enrollments.findById(10L)).thenThrow(new IllegalStateException("db connection lost")).thenAnswer(i -> Optional.of(holder[0]));

        SagaInstance s = start();

        assertThat(s.getState()).isEqualTo(SagaState.REJECTED);
        assertThat(s.getFailureReason()).contains("could not be confirmed");
        InOrder order = inOrder(courses);
        order.verify(courses).reserveSeat(2L, 10L);
        order.verify(courses).releaseSeat(2L, 10L);                   // compensating action
        assertThat(holder[0].getStatus()).isEqualTo(EnrollmentStatus.REJECTED);
        verify(events).record(eq(EnrollmentEventType.EnrollmentRejected), any(), any(), any());
        verify(events, never()).record(eq(EnrollmentEventType.EnrollmentConfirmed), any(), any(), any());
    }

    @Test
    void compensationPausesWhileCourseServiceIsDownAndCompletesOnRecovery() {
        when(courses.reserveSeat(eq(2L), anyLong())).thenReturn(failed(new RemoteConflictException("409")));
        when(courses.releaseSeat(eq(2L), anyLong())).thenReturn(failed(new ServiceUnavailableException("course-service circuit breaker is OPEN")));

        SagaInstance paused = start();

        assertThat(paused.getState()).isEqualTo(SagaState.COMPENSATING);   // persisted, waiting for recovery
        assertThat(paused.getAttempts()).isEqualTo(1);
        verify(events, never()).record(eq(EnrollmentEventType.EnrollmentRejected), any(), any(), any());

        when(courses.releaseSeat(eq(2L), anyLong())).thenReturn(CompletableFuture.completedFuture(new SeatResult(2L, 10L, "RELEASED", 5, false)));
        SagaInstance recovered = orchestrator.run(paused.getSagaId());     // what SagaRecoveryJob does

        assertThat(recovered.getState()).isEqualTo(SagaState.REJECTED);
        verify(events, times(1)).record(eq(EnrollmentEventType.EnrollmentRejected), any(), any(), any());
    }

    @Test
    void duplicateActiveEnrollmentDetectedByDatabaseConstraintIsRejected() {
        when(enrollments.saveAndFlush(any(Enrollment.class))).thenThrow(new DataIntegrityViolationException("uk_sms_enrollments_active"))
                .thenAnswer(i -> { Enrollment e = i.getArgument(0); e.setEnrollmentId(nextEnrollmentId++); db.put(e.getEnrollmentId(), e); return e; });

        SagaInstance s = start();

        assertThat(s.getState()).isEqualTo(SagaState.REJECTED);
        assertThat(s.getFailureReason()).contains("already has an active enrollment");
        verify(courses, never()).reserveSeat(anyLong(), anyLong());
    }

    @Test
    void sameIdempotencyKeyReturnsStoredSagaWithoutRunningAnyStep() {
        SagaInstance existing = new SagaInstance();
        existing.setSagaId(5L); existing.setState(SagaState.COMPLETED); existing.setEnrollmentId(77L);
        when(sagas.findByIdempotencyKey("key-1")).thenReturn(Optional.of(existing));

        SagaInstance s = start();

        assertThat(s).isSameAs(existing);
        verifyNoInteractions(students, courses, events);
        verify(sagas, never()).saveAndFlush(any());
    }

    @Test
    void recoveryResumesFromPersistedStateWithoutRepeatingEarlierSteps() {
        Enrollment pending = new Enrollment();
        pending.setEnrollmentId(10L); pending.setStudentId(1L); pending.setCourseId(2L); pending.setStatus(EnrollmentStatus.PENDING);
        db.put(10L, pending);
        SagaInstance crashed = new SagaInstance();
        crashed.setSagaId(3L); crashed.setIdempotencyKey("key-9"); crashed.setStudentId(1L); crashed.setCourseId(2L);
        crashed.setEnrollmentId(10L); crashed.setState(SagaState.PENDING_CREATED);   // service died right after step 4
        sagaDb.put(3L, crashed);

        SagaInstance s = orchestrator.run(3L);

        assertThat(s.getState()).isEqualTo(SagaState.COMPLETED);
        assertThat(pending.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
        verifyNoInteractions(students);
        verify(courses, never()).getCourse(anyLong());
        verify(courses).reserveSeat(2L, 10L);
    }
}
