package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.EnrollmentOutcomeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class EnrollmentOutcomeProducer {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.enrollment-confirmed}")
    private String enrollmentConfirmedTopic;

    @Value("${app.kafka.topic.enrollment-rejected}")
    private String enrollmentRejectedTopic;

    public EnrollmentOutcomeProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishConfirmed(EnrollmentOutcomeEvent event) {
        publish(enrollmentConfirmedTopic, event);
    }

    public void publishRejected(EnrollmentOutcomeEvent event) {
        publish(enrollmentRejectedTopic, event);
    }

    private void publish(String topic, EnrollmentOutcomeEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, String.valueOf(event.getEnrollmentId()), payload);
            log.info("Published to {}: {}", topic, payload);
        } catch (Exception e) {
            log.error("Failed to publish EnrollmentOutcomeEvent for enrollmentId={}", event.getEnrollmentId(), e);
        }
    }
}
