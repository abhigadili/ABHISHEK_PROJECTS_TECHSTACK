package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * RETRY PATTERN — kicks off the Saga. If this publish fails outright (after
 * every retry attempt), the Enrollment row is left sitting in
 * PENDING_VALIDATION with no Enrollment_Validation counterpart ever created
 * — a real system would reconcile this with a periodic sweep job; this
 * project's guide calls that out as a deliberate simplification.
 */
@Component
public class EnrollmentRequestedProducer {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentRequestedProducer.class);
    private static final String RETRY_INSTANCE = "kafkaPublish";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public EnrollmentRequestedProducer(KafkaTemplate<String, String> kafkaTemplate,
                                        ObjectMapper objectMapper,
                                        @Value("${app.kafka.topic.enrollment-requested}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishFallback")
    public void publish(EnrollmentRequestedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, String.valueOf(event.getEnrollmentId()), payload)
                    .get(3, TimeUnit.SECONDS);
            log.info("Published to {}: enrollmentId={}", topic, event.getEnrollmentId());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to publish enrollment.requested to Kafka", e);
        }
    }

    @SuppressWarnings("unused")
    private void publishFallback(EnrollmentRequestedEvent event, Throwable t) {
        log.error("Giving up publishing enrollment.requested for enrollmentId={} after all retry attempts: {}",
                event.getEnrollmentId(), t.getMessage());
    }
}
