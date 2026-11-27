package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.EnrollmentChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class EnrollmentChangedProducer {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentChangedProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.enrollment-changed}")
    private String enrollmentChangedTopic;

    public EnrollmentChangedProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(EnrollmentChangedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(enrollmentChangedTopic, String.valueOf(event.getEnrollmentId()), payload);
            log.info("Published to {}: {}", enrollmentChangedTopic, payload);
        } catch (Exception e) {
            log.error("Failed to publish EnrollmentChangedEvent for enrollmentId={}", event.getEnrollmentId(), e);
        }
    }
}
