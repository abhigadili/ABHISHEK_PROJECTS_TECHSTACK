package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.EnrollmentOutcomeEvent;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * RETRY PATTERN — publishes the Saga's final outcome; notification-service is
 * listening. publishConfirmed()/publishRejected() are each directly
 * annotated (rather than delegating to one shared private helper) because
 * Resilience4j's annotations are applied via a Spring AOP proxy: a private
 * method can never be proxied, and even a public helper called from another
 * method IN THE SAME CLASS ("self-invocation") bypasses the proxy entirely —
 * the exact same restriction @Transactional is famous for. Two small,
 * independently-annotated methods sidestep both problems.
 */
@Component
public class EnrollmentOutcomeProducer {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeProducer.class);
    private static final String RETRY_INSTANCE = "kafkaPublish";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String confirmedTopic;
    private final String rejectedTopic;

    public EnrollmentOutcomeProducer(KafkaTemplate<String, String> kafkaTemplate,
                                      ObjectMapper objectMapper,
                                      @Value("${app.kafka.topic.enrollment-confirmed}") String confirmedTopic,
                                      @Value("${app.kafka.topic.enrollment-rejected}") String rejectedTopic) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.confirmedTopic = confirmedTopic;
        this.rejectedTopic = rejectedTopic;
    }

    @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishConfirmedFallback")
    public void publishConfirmed(EnrollmentOutcomeEvent event) {
        send(confirmedTopic, event);
    }

    @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishRejectedFallback")
    public void publishRejected(EnrollmentOutcomeEvent event) {
        send(rejectedTopic, event);
    }

    private void send(String topic, EnrollmentOutcomeEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, String.valueOf(event.getEnrollmentId()), payload)
                    .get(3, TimeUnit.SECONDS);
            log.info("Published to {}: enrollmentId={}, status={}", topic, event.getEnrollmentId(), event.getStatus());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to publish enrollment outcome to Kafka", e);
        }
    }

    @SuppressWarnings("unused")
    private void publishConfirmedFallback(EnrollmentOutcomeEvent event, Throwable t) {
        log.error("Giving up publishing CONFIRMED outcome for enrollmentId={} after all retry attempts: {}",
                event.getEnrollmentId(), t.getMessage());
    }

    @SuppressWarnings("unused")
    private void publishRejectedFallback(EnrollmentOutcomeEvent event, Throwable t) {
        log.error("Giving up publishing REJECTED outcome for enrollmentId={} after all retry attempts: {}",
                event.getEnrollmentId(), t.getMessage());
    }
}
