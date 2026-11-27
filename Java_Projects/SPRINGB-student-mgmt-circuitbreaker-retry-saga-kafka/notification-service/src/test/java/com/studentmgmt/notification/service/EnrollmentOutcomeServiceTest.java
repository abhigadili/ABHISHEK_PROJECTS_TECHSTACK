package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class EnrollmentOutcomeServiceTest {

    @Mock
    private NotificationDispatchService notificationDispatchService;

    @Test
    void confirmedOutcomeSendsBothEmailAndSms() {
        EnrollmentOutcomeService service = new EnrollmentOutcomeService(notificationDispatchService);
        EnrollmentOutcomeEvent event = new EnrollmentOutcomeEvent();
        event.setEnrollmentId(37L);
        event.setStudentId(1L);
        event.setCourseId(3L);
        event.setStatus("CONFIRMED");

        service.handle(event);

        verify(notificationDispatchService).dispatch(eq(37L), eq(1L), eq(Notification.Channel.EMAIL), org.mockito.ArgumentMatchers.anyString());
        verify(notificationDispatchService).dispatch(eq(37L), eq(1L), eq(Notification.Channel.SMS), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void rejectedOutcomeSendsOnlyEmail() {
        EnrollmentOutcomeService service = new EnrollmentOutcomeService(notificationDispatchService);
        EnrollmentOutcomeEvent event = new EnrollmentOutcomeEvent();
        event.setEnrollmentId(38L);
        event.setStudentId(2L);
        event.setCourseId(4L);
        event.setStatus("REJECTED");
        event.setReason("Course 4 does not exist");

        service.handle(event);

        verify(notificationDispatchService).dispatch(eq(38L), eq(2L), eq(Notification.Channel.EMAIL), org.mockito.ArgumentMatchers.contains("REJECTED"));
        verify(notificationDispatchService, never()).dispatch(eq(38L), eq(2L), eq(Notification.Channel.SMS), org.mockito.ArgumentMatchers.anyString());
    }
}
