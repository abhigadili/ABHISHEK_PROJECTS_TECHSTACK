package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.entity.EnrollmentValidation;
import com.studentmgmt.enrollment.event.EnrollmentOutcomeEvent;
import com.studentmgmt.enrollment.kafka.EnrollmentOutcomeProducer;
import com.studentmgmt.enrollment.repository.EnrollmentRepository;
import com.studentmgmt.enrollment.repository.EnrollmentValidationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnrollmentSagaServiceTest {

    @Mock
    private EnrollmentValidationRepository enrollmentValidationRepository;
    @Mock
    private EnrollmentRepository enrollmentRepository;
    @Mock
    private EnrollmentStatusService enrollmentStatusService;
    @Mock
    private EnrollmentOutcomeProducer enrollmentOutcomeProducer;

    private EnrollmentSagaService sagaService;

    @BeforeEach
    void setUp() {
        sagaService = new EnrollmentSagaService(
                enrollmentValidationRepository, enrollmentRepository, enrollmentStatusService, enrollmentOutcomeProducer);
    }

    @Test
    void doesNotResolveWhenOnlyOneReplyHasArrived() {
        EnrollmentValidation validation = new EnrollmentValidation();
        validation.setEnrollmentId(1L);
        validation.setStudentValid(true); // course side still NULL
        when(enrollmentValidationRepository.findById(1L)).thenReturn(Optional.of(validation));

        sagaService.applyStudentValidationResult(1L, true, "Student exists");

        verify(enrollmentRepository, never()).save(any());
        verify(enrollmentOutcomeProducer, never()).publishConfirmed(any());
        verify(enrollmentOutcomeProducer, never()).publishRejected(any());
    }

    @Test
    void resolvesToConfirmedWhenBothRepliesAreValid() {
        EnrollmentValidation validation = new EnrollmentValidation();
        validation.setEnrollmentId(1L);
        validation.setStudentValid(true);
        validation.setCourseValid(true);
        when(enrollmentValidationRepository.findById(1L)).thenReturn(Optional.of(validation));

        Enrollment enrollment = new Enrollment();
        enrollment.setEnrollmentId(1L);
        enrollment.setStudentId(10L);
        enrollment.setCourseId(20L);
        when(enrollmentRepository.findById(1L)).thenReturn(Optional.of(enrollment));

        EnrollmentStatus confirmedStatus = new EnrollmentStatus();
        confirmedStatus.setStatusId(2L);
        confirmedStatus.setStatusName("CONFIRMED");
        when(enrollmentStatusService.findByStatusName("CONFIRMED")).thenReturn(confirmedStatus);

        sagaService.applyCourseValidationResult(1L, true, "Course exists");

        assertThat(enrollment.getStatusId()).isEqualTo(2L);
        assertThat(enrollment.getRejectionReason()).isNull();
        verify(enrollmentRepository).save(enrollment);

        ArgumentCaptor<EnrollmentOutcomeEvent> captor = ArgumentCaptor.forClass(EnrollmentOutcomeEvent.class);
        verify(enrollmentOutcomeProducer).publishConfirmed(captor.capture());
        verify(enrollmentOutcomeProducer, never()).publishRejected(any());
        assertThat(captor.getValue().getStatus()).isEqualTo("CONFIRMED");
    }

    @Test
    void resolvesToRejectedWhenEitherReplyIsInvalidAndCombinesReasons() {
        EnrollmentValidation validation = new EnrollmentValidation();
        validation.setEnrollmentId(1L);
        validation.setStudentValid(false);
        validation.setStudentReason("Student 99 does not exist");
        validation.setCourseValid(true);
        validation.setCourseReason("Course exists");
        when(enrollmentValidationRepository.findById(1L)).thenReturn(Optional.of(validation));

        Enrollment enrollment = new Enrollment();
        enrollment.setEnrollmentId(1L);
        enrollment.setStudentId(99L);
        enrollment.setCourseId(20L);
        when(enrollmentRepository.findById(1L)).thenReturn(Optional.of(enrollment));

        EnrollmentStatus rejectedStatus = new EnrollmentStatus();
        rejectedStatus.setStatusId(3L);
        rejectedStatus.setStatusName("REJECTED");
        when(enrollmentStatusService.findByStatusName("REJECTED")).thenReturn(rejectedStatus);

        sagaService.applyCourseValidationResult(1L, true, "Course exists");

        assertThat(enrollment.getStatusId()).isEqualTo(3L);
        assertThat(enrollment.getRejectionReason()).isEqualTo("Student 99 does not exist");

        ArgumentCaptor<EnrollmentOutcomeEvent> captor = ArgumentCaptor.forClass(EnrollmentOutcomeEvent.class);
        verify(enrollmentOutcomeProducer).publishRejected(captor.capture());
        verify(enrollmentOutcomeProducer, never()).publishConfirmed(any());
        assertThat(captor.getValue().getStatus()).isEqualTo("REJECTED");
    }
}
