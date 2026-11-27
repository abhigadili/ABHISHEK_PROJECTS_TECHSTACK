package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.repository.NotificationRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Exercises the REAL NotificationDispatchService end-to-end against a real
 * (in-process) Resilience4j Retry + CircuitBreaker pair — only the
 * repository is mocked, so no database is needed. This directly proves the
 * behavior described in NotificationDispatchService's class comment:
 * retries are invisible to the circuit breaker's failure count, and once
 * OPEN, the simulated gateway is never even called.
 */
@ExtendWith(MockitoExtension.class)
class NotificationDispatchServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    private SimulatedExternalGateway gateway;
    private NotificationDispatchService dispatchService;

    @BeforeEach
    void setUp() {
        gateway = new SimulatedExternalGateway();

        RetryConfig retryConfig = RetryConfig.custom()
                .maxAttempts(3)
                .waitDuration(Duration.ofMillis(5))
                .build();
        RetryRegistry retryRegistry = RetryRegistry.of(retryConfig);

        CircuitBreakerConfig cbConfig = CircuitBreakerConfig.custom()
                .slidingWindowSize(4)
                .minimumNumberOfCalls(4)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(30)) // long enough it never auto-recovers mid-test
                .build();
        CircuitBreakerRegistry circuitBreakerRegistry = CircuitBreakerRegistry.of(cbConfig);

        // Both registries default-configure an instance the first time it's
        // asked for by name — same "notificationGateway" name application.properties uses.
        dispatchService = new NotificationDispatchService(gateway, notificationRepository, retryRegistry, circuitBreakerRegistry);

        when(notificationRepository.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void healthyGatewaySucceedsOnFirstAttempt() {
        Notification result = dispatchService.dispatch(1L, 10L, Notification.Channel.EMAIL, "Welcome!");

        assertThat(result.getStatus()).isEqualTo(Notification.Status.SENT);
        assertThat(result.getAttemptCount()).isEqualTo(1);
    }

    @Test
    void failingGatewayExhaustsAllRetryAttemptsBeforeMarkingFailed() {
        gateway.setForcedFailure(true);

        Notification result = dispatchService.dispatch(1L, 10L, Notification.Channel.EMAIL, "Welcome!");

        assertThat(result.getStatus()).isEqualTo(Notification.Status.FAILED);
        assertThat(result.getAttemptCount()).isEqualTo(3); // maxAttempts from RetryConfig above
    }

    @Test
    void circuitOpensAfterEnoughFailedDispatchesAndStopsCallingTheGatewayAtAll() {
        gateway.setForcedFailure(true);

        // 4 dispatch calls, all failing (each internally retries 3x) — enough
        // to trip a circuit breaker with slidingWindowSize=4, threshold=50%.
        for (int i = 0; i < 4; i++) {
            dispatchService.dispatch(1L, 10L, Notification.Channel.EMAIL, "Welcome!");
        }

        // The 5th call must be short-circuited: CircuitBreaker rejects it
        // before Retry (and therefore the gateway) ever runs — attemptCount stays 0.
        Notification result = dispatchService.dispatch(1L, 10L, Notification.Channel.EMAIL, "Welcome!");

        assertThat(result.getStatus()).isEqualTo(Notification.Status.FAILED);
        assertThat(result.getAttemptCount()).isEqualTo(0);
    }
}
