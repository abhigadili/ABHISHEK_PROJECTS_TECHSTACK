package com.example.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.example.events.EnrollmentEvent;
import com.example.events.EnrollmentEventType;
import com.example.events.LowCourseAvailabilityEvent;
import com.example.notification.entity.InboxMessage;
import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.entity.NotificationType;
import com.example.notification.repository.InboxMessageRepository;
import com.example.notification.repository.NotificationRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationIngestServiceTest {
    @Mock InboxMessageRepository inbox;
    @Mock NotificationRepository notifications;
    NotificationIngestService service;

    @BeforeEach
    void setUp() { service = new NotificationIngestService(inbox, notifications, "admin@sms.local"); }

    private static EnrollmentEvent event(EnrollmentEventType type, String id) {
        return new EnrollmentEvent(id, type, 10L, 1L, 2L, "Asha Rao", "asha@example.com", "Java", "no seats", "corr", Instant.now());
    }

    @Test
    void confirmedEventCreatesPendingNotificationAndInboxRow() {
        when(inbox.existsByMessageIdAndConsumerGroup("e1", "notification-service")).thenReturn(false);

        assertThat(service.handleEnrollmentEvent(event(EnrollmentEventType.EnrollmentConfirmed, "e1"), "enrollment.confirmed")).isTrue();

        ArgumentCaptor<Notification> n = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(n.capture());
        assertThat(n.getValue().getNotificationType()).isEqualTo(NotificationType.ENROLLMENT_CONFIRMED);
        assertThat(n.getValue().getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(n.getValue().getRecipientEmail()).isEqualTo("asha@example.com");
        assertThat(n.getValue().getMessage()).contains("Asha Rao").contains("Java").contains("confirmed");
        verify(inbox).saveAndFlush(any(InboxMessage.class));
    }

    @Test
    void redeliveredEventIsIgnoredViaInbox() {
        when(inbox.existsByMessageIdAndConsumerGroup("e1", "notification-service")).thenReturn(true);

        assertThat(service.handleEnrollmentEvent(event(EnrollmentEventType.EnrollmentConfirmed, "e1"), "enrollment.confirmed")).isFalse();

        verify(inbox, never()).saveAndFlush(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void secondEventForSameEnrollmentAndTypeDoesNotCreateDuplicateNotification() {
        when(notifications.existsByEnrollmentIdAndNotificationType(10L, NotificationType.ENROLLMENT_CANCELLED)).thenReturn(true);
        assertThat(service.handleEnrollmentEvent(event(EnrollmentEventType.EnrollmentCancelled, "e9"), "enrollment.cancelled")).isFalse();
        verify(notifications, never()).save(any());
        verify(inbox).saveAndFlush(any());   // still recorded as processed
    }

    @Test
    void requestedEventIsRecordedButProducesNoNotification() {
        assertThat(service.handleEnrollmentEvent(event(EnrollmentEventType.EnrollmentRequested, "e2"), "enrollment.requested")).isFalse();
        verify(inbox).saveAndFlush(any());
        verifyNoInteractions(notifications);
    }

    @Test
    void rejectedMessageContainsTheReason() {
        service.handleEnrollmentEvent(event(EnrollmentEventType.EnrollmentRejected, "e3"), "enrollment.rejected");
        ArgumentCaptor<Notification> n = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(n.capture());
        assertThat(n.getValue().getMessage()).contains("rejected").contains("no seats");
    }

    @Test
    void lowAvailabilityGoesToTheAdminMailbox() {
        service.handleLowAvailability(new LowCourseAvailabilityEvent("l1", 2L, "JMS-101", "Java", 3, 30, Instant.now()), "course.low-availability");
        ArgumentCaptor<Notification> n = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(n.capture());
        assertThat(n.getValue().getRecipientEmail()).isEqualTo("admin@sms.local");
        assertThat(n.getValue().getStudentId()).isNull();
        assertThat(n.getValue().getMessage()).contains("3 of 30");
    }
}
