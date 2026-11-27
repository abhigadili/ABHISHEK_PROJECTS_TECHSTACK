package com.studentmgmt.student.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.student.event.ValidationResultEvent;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * RETRY PATTERN — the whole point of this class.
 *
 * publish() calls kafkaTemplate.send(...).get(3, SECONDS): turning the
 * normally-asynchronous CompletableFuture into a synchronous call so that a
 * broker-side problem (temporary unavailability, a slow leader election
 * after a broker restart, ...) surfaces here as a thrown exception instead
 * of silently failing on a background thread. @Retry wraps that call: on
 * failure it waits (application.properties: kafkaPublish.wait-duration) and
 * tries again, up to max-attempts times, with NO CODE CHANGE required in the
 * caller (EnrollmentRequestedListener) — it just calls publish() normally.
 *
 * If every attempt fails, Resilience4j calls publishFallback() instead of
 * throwing — the fallback method must have the exact same parameters as the
 * original PLUS a trailing Throwable, and the same return type (void here).
 * We log loudly rather than silently swallowing the failure: in a real
 * system this is exactly the place to write a "poison" record to a
 * dead-letter topic or an outbox table for manual/automatic replay.
 */
@Component
public class ValidationResultProducer {

    private static final Logger log = LoggerFactory.getLogger(ValidationResultProducer.class);
    private static final String RETRY_INSTANCE = "kafkaPublish";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public ValidationResultProducer(KafkaTemplate<String, String> kafkaTemplate,
                                     ObjectMapper objectMapper,
                                     @Value("${app.kafka.topic.student-validation-result}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishFallback")
    public void publish(ValidationResultEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, String.valueOf(event.getEnrollmentId()), payload)
                    .get(3, TimeUnit.SECONDS);
            log.info("Published to {}: enrollmentId={}, valid={}", topic, event.getEnrollmentId(), event.isValid());
        } catch (Exception e) {
            // Wrapped as unchecked so @Retry (which only intercepts exceptions
            // escaping the method) actually sees this attempt as a failure.
            throw new IllegalStateException("Failed to publish validation result to Kafka", e);
        }
    }

    @SuppressWarnings("unused")
    private void publishFallback(ValidationResultEvent event, Throwable t) {
        log.error("Giving up publishing validation result for enrollmentId={} after all retry attempts: {}",
                event.getEnrollmentId(), t.getMessage());
    }
}
