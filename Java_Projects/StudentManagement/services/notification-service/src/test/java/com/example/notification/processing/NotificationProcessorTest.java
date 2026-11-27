package com.example.notification.processing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.example.notification.entity.Notification;
import com.example.notification.entity.NotificationStatus;
import com.example.notification.repository.NotificationRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationProcessorTest {
    @Mock NotificationRepository repository;
    NotificationProcessor processor;

    @BeforeEach
    void setUp() { processor = new NotificationProcessor(repository, new EmailSimulator(), 3, 10); }

    private Notification pending(String email, int retries) {
        Notification n = new Notification();
        n.setNotificationId(1L); n.setRecipientEmail(email); n.setMessage("hello"); n.setStatus(NotificationStatus.PENDING); n.setRetryCount(retries);
        when(repository.findById(1L)).thenReturn(Optional.of(n));
        return n;
    }

    @Test
    void successfulSendMarksSentAndSetsProcessedAt() {
        Notification n = pending("a@example.com", 0);
        processor.process(1L);
        assertThat(n.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(n.getProcessedAt()).isNotNull();
        verify(repository).save(n);
    }

    @Test
    void transientFailureSchedulesRetryWithExponentialBackoff() {
        Notification n = pending("x@fail.test", 0);
        processor.process(1L);
        assertThat(n.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(n.getRetryCount()).isEqualTo(1);
        assertThat(n.getNextAttemptAt()).isBetween(LocalDateTime.now().plusSeconds(8), LocalDateTime.now().plusSeconds(11));   // base 10s * 2^0

        n.setRetryCount(1);
        processor.process(1L);
        assertThat(n.getNextAttemptAt()).isBetween(LocalDateTime.now().plusSeconds(18), LocalDateTime.now().plusSeconds(21));  // base 10s * 2^1
    }

    @Test
    void failsPermanentlyWhenMaxAttemptsReached() {
        Notification n = pending("x@fail.test", 2);
        processor.process(1L);
        assertThat(n.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(n.getRetryCount()).isEqualTo(3);
        assertThat(n.getLastError()).contains("Simulated SMTP failure");
    }

    @Test
    void flakyRecipientEventuallySucceeds() {
        Notification n = pending("x@flaky.test", 2);   // fails only on the first two attempts
        processor.process(1L);
        assertThat(n.getStatus()).isEqualTo(NotificationStatus.SENT);
    }

    @Test
    void missingRecipientFailsImmediatelyWithoutRetry() {
        Notification n = pending(null, 0);
        processor.process(1L);
        assertThat(n.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(n.getRetryCount()).isEqualTo(1);
    }

    @Test
    void alreadyProcessedNotificationsAreSkipped() {
        Notification n = pending("a@example.com", 0);
        n.setStatus(NotificationStatus.SENT);
        processor.process(1L);
        verify(repository, never()).save(n);
    }
}
