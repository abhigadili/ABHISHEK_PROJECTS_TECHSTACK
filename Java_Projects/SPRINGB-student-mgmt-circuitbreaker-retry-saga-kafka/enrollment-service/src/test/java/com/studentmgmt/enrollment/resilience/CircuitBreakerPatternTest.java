package com.studentmgmt.enrollment.resilience;

import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Demonstrates — independently of Spring, RestTemplate, or any of this
 * project's own code — exactly what `@CircuitBreaker(name = "...")` on
 * StudentServiceClient.getStudent() / CourseServiceClient.getCourse() does
 * under the hood: the same io.github.resilience4j.circuitbreaker.CircuitBreaker
 * engine Spring Boot auto-configures from application.properties, built by
 * hand here with the same shape (window of 5 calls, 50% failure threshold)
 * so the CLOSED → OPEN transition — and what OPEN actually means for the
 * caller — can be proven without a live student-service/course-service.
 */
class CircuitBreakerPatternTest {

    private final CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .slidingWindowSize(5)
            .minimumNumberOfCalls(5)
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofSeconds(1))
            .permittedNumberOfCallsInHalfOpenState(2)
            .build();

    @Test
    void staysClosedWhileMostCallsSucceed() {
        CircuitBreaker breaker = CircuitBreaker.of("studentServiceClient-test-healthy", config);

        for (int i = 0; i < 5; i++) {
            int attempt = i;
            Supplier<String> call = CircuitBreaker.decorateSupplier(breaker, () ->
                    attempt == 0 ? failOnce() : "ok");
            if (attempt == 0) {
                assertThatThrownBy(call::get); // one failure out of five — under the 50% threshold
            } else {
                assertThat(call.get()).isEqualTo("ok");
            }
        }

        assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void tripsOpenAfterEnoughFailuresAndThenShortCircuitsImmediately() {
        CircuitBreaker breaker = CircuitBreaker.of("studentServiceClient-test-unhealthy", config);

        // 5 calls, all failing — well over the 50% failure-rate-threshold with minimumNumberOfCalls=5 reached.
        for (int i = 0; i < 5; i++) {
            Supplier<String> failingCall = CircuitBreaker.decorateSupplier(breaker, this::alwaysFails);
            assertThatThrownBy(failingCall::get);
        }

        assertThat(breaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        // The 6th call must NOT even attempt the (simulated) remote call — Resilience4j
        // rejects it immediately with CallNotPermittedException. This is the entire point
        // of the pattern: a struggling dependency stops being hammered with more requests.
        Supplier<String> shouldBeShortCircuited = CircuitBreaker.decorateSupplier(breaker, () -> {
            throw new AssertionError("Should never actually be invoked while OPEN");
        });
        assertThatThrownBy(shouldBeShortCircuited::get).isInstanceOf(CallNotPermittedException.class);
    }

    private String alwaysFails() {
        throw new IllegalStateException("Simulated student-service outage");
    }

    private String failOnce() {
        throw new IllegalStateException("Simulated one-off blip, not a real outage");
    }
}
