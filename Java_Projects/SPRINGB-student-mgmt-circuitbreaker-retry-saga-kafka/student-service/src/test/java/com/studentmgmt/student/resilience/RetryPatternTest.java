package com.studentmgmt.student.resilience;

import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Demonstrates — independently of Spring, KafkaTemplate, or any of this
 * project's own code — exactly what the `@Retry(name = "kafkaPublish")`
 * annotation on ValidationResultProducer.publish() does under the hood.
 * This is the same io.github.resilience4j.retry.Retry engine Spring Boot
 * auto-configures from application.properties; here it's built by hand with
 * the same shape (3 attempts, exponential backoff) so the mechanism can be
 * proven in a plain unit test with no live Kafka broker required.
 */
class RetryPatternTest {

    private final RetryConfig config = RetryConfig.custom()
            .maxAttempts(3)
            .intervalFunction(io.github.resilience4j.core.IntervalFunction.ofExponentialBackoff(Duration.ofMillis(10), 2))
            .retryExceptions(IllegalStateException.class)
            .build();

    @Test
    void succeedsOnThirdAttemptWithoutExhaustingRetries() {
        Retry retry = Retry.of("kafkaPublish-test", config);
        AtomicInteger attempts = new AtomicInteger(0);

        Supplier<String> flaky = Retry.decorateSupplier(retry, () -> {
            int attempt = attempts.incrementAndGet();
            if (attempt < 3) {
                throw new IllegalStateException("Simulated transient Kafka broker failure, attempt " + attempt);
            }
            return "published";
        });

        String result = flaky.get();

        assertThat(result).isEqualTo("published");
        assertThat(attempts.get()).isEqualTo(3);
    }

    @Test
    void givesUpAfterMaxAttemptsAndPropagatesTheLastFailure() {
        Retry retry = Retry.of("kafkaPublish-test-exhausted", config);
        AtomicInteger attempts = new AtomicInteger(0);

        Supplier<String> alwaysFails = Retry.decorateSupplier(retry, () -> {
            attempts.incrementAndGet();
            throw new IllegalStateException("Kafka broker is permanently unreachable in this test");
        });

        assertThatThrownBy(alwaysFails::get).isInstanceOf(IllegalStateException.class);
        // maxAttempts=3 means exactly 3 tries total: the original call + 2 retries, then give up.
        assertThat(attempts.get()).isEqualTo(3);
    }

    @Test
    void doesNotRetryExceptionsOutsideTheConfiguredRetryList() {
        Retry retry = Retry.of("kafkaPublish-test-wrong-exception", config);
        AtomicInteger attempts = new AtomicInteger(0);

        Supplier<String> failsWithUnretriedException = Retry.decorateSupplier(retry, () -> {
            attempts.incrementAndGet();
            throw new RuntimeException("Not in retryExceptions — e.g. a bad JSON payload, not worth retrying");
        });

        assertThatThrownBy(failsWithUnretriedException::get).isInstanceOf(RuntimeException.class);
        assertThat(attempts.get()).isEqualTo(1);
    }
}
