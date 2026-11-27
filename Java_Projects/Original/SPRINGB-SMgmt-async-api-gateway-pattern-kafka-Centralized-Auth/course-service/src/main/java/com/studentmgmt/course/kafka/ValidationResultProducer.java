package com.studentmgmt.course.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.event.ValidationResultEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/** Thin wrapper around KafkaTemplate — the only place in this service that publishes events. */
@Component
public class ValidationResultProducer {

    private static final Logger log = LoggerFactory.getLogger(ValidationResultProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.course-validation-result}")
    private String courseValidationResultTopic;

    public ValidationResultProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(ValidationResultEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(courseValidationResultTopic, String.valueOf(event.getEnrollmentId()), payload);
            log.info("Published to {}: {}", courseValidationResultTopic, payload);
        } catch (Exception e) {
            log.error("Failed to publish ValidationResultEvent for enrollmentId={}", event.getEnrollmentId(), e);
        }
    }
}
