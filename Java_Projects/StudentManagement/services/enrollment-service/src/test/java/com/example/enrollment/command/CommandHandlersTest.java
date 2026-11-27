package com.example.enrollment.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.example.common.exception.BusinessRuleException;
import com.example.common.exception.ConflictException;
import com.example.common.exception.ResourceNotFoundException;
import com.example.common.exception.ServiceUnavailableException;
import com.example.enrollment.client.CourseGateway;
import com.example.enrollment.client.RemoteDtos.SeatResult;
import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import com.example.enrollment.entity.SagaInstance;
import com.example.enrollment.entity.SagaState;
import com.example.enrollment.event.EnrollmentEventRecorder;
import com.example.enrollment.repository.EnrollmentRepository;
import com.example.enrollment.repository.SagaInstanceRepository;
import com.example.enrollment.saga.EnrollmentSagaOrchestrator;
import com.example.events.EnrollmentEventType;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CommandHandlersTest {
    @Mock EnrollmentSagaOrchestrator saga;
    @Mock SagaInstanceRepository sagas;
    @Mock EnrollmentRepository enrollments;
    @Mock CourseGateway courses;
    @Mock EnrollmentEventRecorder events;
    @Mock PlatformTransactionManager txManager;

    private static Enrollment enrollment(EnrollmentStatus status) {
        Enrollment e = new Enrollment();
        e.setEnrollmentId(1L); e.setStudentId(5L); e.setCourseId(6L); e.setStatus(status); e.setIdempotencyKey("k");
        return e;
    }

    // ---------------------------------------------------------------- create
    @Test
    void createRejectsDuplicateActiveEnrollmentBeforeStartingTheSaga() {
        var handler = new CreateEnrollmentCommandHandler(saga, sagas, enrollments);
        when(sagas.findByIdempotencyKey("new-key")).thenReturn(Optional.empty());
        when(enrollments.existsByStudentIdAndCourseIdAndStatusIn(eq(5L), eq(6L), any())).thenReturn(true);

        assertThatThrownBy(() -> handler.handle(new CreateEnrollmentCommand(5L, 6L, "new-key", null))).isInstanceOf(ConflictException.class);
        verifyNoInteractions(saga);
    }

    @Test
    void createMapsSagaStatesToOutcomes() {
        var handler = new CreateEnrollmentCommandHandler(saga, sagas, enrollments);
        SagaInstance done = new SagaInstance();
        done.setState(SagaState.COMPLETED); done.setEnrollmentId(1L);
        when(saga.start("k1", 5L, 6L, null)).thenReturn(done);
        when(enrollments.findById(1L)).thenReturn(Optional.of(enrollment(EnrollmentStatus.CONFIRMED)));
        assertThat(handler.handle(new CreateEnrollmentCommand(5L, 6L, "k1", null)).result()).isEqualTo(EnrollmentOutcome.CONFIRMED);

        SagaInstance rejected = new SagaInstance();
        rejected.setState(SagaState.REJECTED); rejected.setFailureReason("no seats");
        when(saga.start("k2", 5L, 6L, null)).thenReturn(rejected);
        var out = handler.handle(new CreateEnrollmentCommand(5L, 6L, "k2", null));
        assertThat(out.result()).isEqualTo(EnrollmentOutcome.REJECTED);
        assertThat(out.message()).isEqualTo("no seats");

        SagaInstance paused = new SagaInstance();
        paused.setState(SagaState.COMPENSATING);
        when(saga.start("k3", 5L, 6L, null)).thenReturn(paused);
        assertThat(handler.handle(new CreateEnrollmentCommand(5L, 6L, "k3", null)).result()).isEqualTo(EnrollmentOutcome.IN_PROGRESS);
    }

    @Test
    void replayOfAnExistingKeySkipsTheDuplicateCheck() {
        var handler = new CreateEnrollmentCommandHandler(saga, sagas, enrollments);
        when(sagas.findByIdempotencyKey("k1")).thenReturn(Optional.of(new SagaInstance()));
        SagaInstance done = new SagaInstance();
        done.setState(SagaState.COMPLETED);
        when(saga.start("k1", 5L, 6L, null)).thenReturn(done);

        handler.handle(new CreateEnrollmentCommand(5L, 6L, "k1", null));

        verify(enrollments, never()).existsByStudentIdAndCourseIdAndStatusIn(any(), any(), any());
    }

    // ---------------------------------------------------------------- cancel
    private CancelEnrollmentCommandHandler cancelHandler() {
        return new CancelEnrollmentCommandHandler(enrollments, courses, events, new TransactionTemplate(txManager));
    }

    @Test
    void cancelReleasesSeatThenMarksCancelledAndStoresEvent() {
        Enrollment e = enrollment(EnrollmentStatus.CONFIRMED);
        when(enrollments.findById(1L)).thenReturn(Optional.of(e));
        when(courses.releaseSeat(6L, 1L)).thenReturn(CompletableFuture.completedFuture(new SeatResult(6L, 1L, "RELEASED", 3, false)));

        var response = cancelHandler().handle(new CancelEnrollmentCommand(1L, "moved"));

        assertThat(response.enrollmentStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
        assertThat(e.getRemarks()).isEqualTo("moved");
        var inOrder = inOrder(courses, events);
        inOrder.verify(courses).releaseSeat(6L, 1L);
        inOrder.verify(events).record(eq(EnrollmentEventType.EnrollmentCancelled), eq(e), eq("moved"), any());
    }

    @Test
    void cancelChangesNothingWhenSeatReleaseFails() {
        Enrollment e = enrollment(EnrollmentStatus.CONFIRMED);
        when(enrollments.findById(1L)).thenReturn(Optional.of(e));
        when(courses.releaseSeat(6L, 1L)).thenReturn(CompletableFuture.failedFuture(new java.io.IOException("connection refused")));

        assertThatThrownBy(() -> cancelHandler().handle(new CancelEnrollmentCommand(1L, null))).isInstanceOf(ServiceUnavailableException.class);

        assertThat(e.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
        verifyNoInteractions(events);
    }

    @Test
    void cancelIsOnlyAllowedForConfirmedEnrollments() {
        when(enrollments.findById(1L)).thenReturn(Optional.of(enrollment(EnrollmentStatus.PENDING)), Optional.of(enrollment(EnrollmentStatus.REJECTED)),
                Optional.of(enrollment(EnrollmentStatus.CANCELLED)));
        assertThatThrownBy(() -> cancelHandler().handle(new CancelEnrollmentCommand(1L, null))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> cancelHandler().handle(new CancelEnrollmentCommand(1L, null))).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> cancelHandler().handle(new CancelEnrollmentCommand(1L, null))).isInstanceOf(BusinessRuleException.class);
        verifyNoInteractions(courses);
    }

    @Test
    void cancelUnknownEnrollmentIs404() {
        when(enrollments.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> cancelHandler().handle(new CancelEnrollmentCommand(99L, null))).isInstanceOf(ResourceNotFoundException.class);
    }

    // ---------------------------------------------------------------- update
    @Test
    void updateOnlyChangesRemarksNeverTheStatus() {
        Enrollment e = enrollment(EnrollmentStatus.CONFIRMED);
        when(enrollments.findById(1L)).thenReturn(Optional.of(e));
        when(enrollments.saveAndFlush(e)).thenReturn(e);

        var r = new UpdateEnrollmentCommandHandler(enrollments).handle(new UpdateEnrollmentCommand(1L, "VIP"));

        assertThat(r.remarks()).isEqualTo("VIP");
        assertThat(r.enrollmentStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    }
}
