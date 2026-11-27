package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import com.studentmgmt.enrollment.kafka.EnrollmentRequestedProducer;
import com.studentmgmt.enrollment.repository.EnrollmentRepository;
import com.studentmgmt.enrollment.repository.EnrollmentValidationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;
    @Mock
    private EnrollmentValidationRepository enrollmentValidationRepository;
    @Mock
    private EnrollmentStatusService enrollmentStatusService;
    @Mock
    private EnrollmentRequestedProducer enrollmentRequestedProducer;

    @InjectMocks
    private EnrollmentService enrollmentService;

    @Test
    void createStartsTheSagaWithPendingValidationStatusAndPublishesRequestedEvent() {
        EnrollmentStatus pending = new EnrollmentStatus();
        pending.setStatusId(1L);
        pending.setStatusName("PENDING_VALIDATION");
        when(enrollmentStatusService.findByStatusName("PENDING_VALIDATION")).thenReturn(pending);

        Enrollment incoming = new Enrollment();
        incoming.setStudentId(1L);
        incoming.setCourseId(3L);

        when(enrollmentRepository.save(any())).thenAnswer(invocation -> {
            Enrollment e = invocation.getArgument(0);
            e.setEnrollmentId(37L);
            return e;
        });

        Enrollment result = enrollmentService.create(incoming);

        assertThat(result.getStatusId()).isEqualTo(1L);
        assertThat(result.getEnrollmentId()).isEqualTo(37L);
        verify(enrollmentValidationRepository).save(any());

        ArgumentCaptor<EnrollmentRequestedEvent> captor = ArgumentCaptor.forClass(EnrollmentRequestedEvent.class);
        verify(enrollmentRequestedProducer).publish(captor.capture());
        assertThat(captor.getValue().getEnrollmentId()).isEqualTo(37L);
        assertThat(captor.getValue().getStudentId()).isEqualTo(1L);
        assertThat(captor.getValue().getCourseId()).isEqualTo(3L);
    }
}
