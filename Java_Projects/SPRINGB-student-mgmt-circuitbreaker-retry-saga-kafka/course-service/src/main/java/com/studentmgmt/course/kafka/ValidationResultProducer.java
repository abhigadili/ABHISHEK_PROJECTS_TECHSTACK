package com.studentmgmt.course.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.event.ValidationResultEvent;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * RETRY PATTERN — mirrors student-service's ValidationResultProducer exactly;
 * see that class for the full explanation. Each service applies the pattern
 * independently, with its own Resilience4j Retry instance name/config, which
 * is realistic: two services calling the same Kafka broker can have
 * different tolerance for transient failures.
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
                                     @Value("${app.kafka.topic.course-validation-result}") String topic) {
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
            throw new IllegalStateException("Failed to publish validation result to Kafka", e);
        }
    }

    @SuppressWarnings("unused")
    private void publishFallback(ValidationResultEvent event, Throwable t) {
        log.error("Giving up publishing validation result for enrollmentId={} after all retry attempts: {}",
                event.getEnrollmentId(), t.getMessage());
    }
}
