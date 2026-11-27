package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class EnrollmentRequestedProducer {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentRequestedProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.enrollment-requested}")
    private String enrollmentRequestedTopic;

    public EnrollmentRequestedProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(EnrollmentRequestedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(enrollmentRequestedTopic, String.valueOf(event.getEnrollmentId()), payload);
            log.info("Published to {}: {}", enrollmentRequestedTopic, payload);
        } catch (Exception e) {
            log.error("Failed to publish EnrollmentRequestedEvent for enrollmentId={}", event.getEnrollmentId(), e);
        }
    }
}
