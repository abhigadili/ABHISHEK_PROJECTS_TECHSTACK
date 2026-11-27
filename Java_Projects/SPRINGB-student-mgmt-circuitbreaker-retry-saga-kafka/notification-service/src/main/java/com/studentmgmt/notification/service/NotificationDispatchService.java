package com.studentmgmt.notification.service;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.repository.NotificationRepository;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.decorators.Decorators;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/**
 * RETRY + CIRCUIT BREAKER COMBINED — this project's other two Resilience4j
 * demos (ValidationResultProducer's Kafka publish, StudentServiceClient /
 * CourseServiceClient's HTTP calls) use the `@Retry` / `@CircuitBreaker`
 * ANNOTATIONS, the simplest style for typical cases. This class instead
 * builds the same protection PROGRAMMATICALLY from RetryRegistry +
 * CircuitBreakerRegistry (both auto-configured by Spring Boot from the
 * "notificationGateway" settings in application.properties) — useful when,
 * like here, you need something the annotation can't give you: the exact
 * number of attempts made, so it can be recorded on the Notification row.
 *
 * Composition order matters: `.withRetry(retry).withCircuitBreaker(breaker)`
 * makes the CIRCUIT BREAKER THE OUTERMOST layer and RETRY THE INNERMOST —
 * this is Resilience4j's own documented default order for the equivalent
 * annotations. Concretely: if the gateway fails, Retry silently re-attempts
 * it (up to its configured max) BEFORE the circuit breaker ever sees a
 * result — so 3 failed retry attempts count as ONE failed call towards the
 * circuit breaker's failure-rate-threshold, not three. Once OPEN, the
 * circuit breaker rejects the call immediately with
 * CallNotPermittedException — Retry's supplier is never even invoked, so
 * `attempts` stays at 0 for that Notification row.
 */
@Service
public class NotificationDispatchService {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatchService.class);
    private static final String INSTANCE_NAME = "notificationGateway";

    private final SimulatedExternalGateway gateway;
    private final NotificationRepository notificationRepository;
    private final Retry retry;
    private final CircuitBreaker circuitBreaker;

    public NotificationDispatchService(SimulatedExternalGateway gateway,
                                        NotificationRepository notificationRepository,
                                        RetryRegistry retryRegistry,
                                        CircuitBreakerRegistry circuitBreakerRegistry) {
        this.gateway = gateway;
        this.notificationRepository = notificationRepository;
        this.retry = retryRegistry.retry(INSTANCE_NAME);
        this.circuitBreaker = circuitBreakerRegistry.circuitBreaker(INSTANCE_NAME);
    }

    public Notification dispatch(Long enrollmentId, Long studentId, Notification.Channel channel, String message) {
        AtomicInteger attempts = new AtomicInteger(0);

        Supplier<Void> action = () -> {
            attempts.incrementAndGet();
            gateway.send(channel.name(), message);
            return null;
        };
        Supplier<Void> protectedAction = Decorators.ofSupplier(action)
                .withRetry(retry)
                .withCircuitBreaker(circuitBreaker)
                .decorate();

        Notification notification = new Notification();
        notification.setEnrollmentId(enrollmentId);
        notification.setStudentId(studentId);
        notification.setChannel(channel);
        notification.setMessage(message);

        try {
            protectedAction.get();
            notification.setStatus(Notification.Status.SENT);
            log.info("Notification SENT: enrollmentId={}, channel={}, attempts={}", enrollmentId, channel, attempts.get());
        } catch (Exception e) {
            notification.setStatus(Notification.Status.FAILED);
            log.error("Notification FAILED: enrollmentId={}, channel={}, attempts={}, reason={}",
                    enrollmentId, channel, attempts.get(), e.toString());
        }
        notification.setAttemptCount(attempts.get());
        return notificationRepository.save(notification);
    }
}
