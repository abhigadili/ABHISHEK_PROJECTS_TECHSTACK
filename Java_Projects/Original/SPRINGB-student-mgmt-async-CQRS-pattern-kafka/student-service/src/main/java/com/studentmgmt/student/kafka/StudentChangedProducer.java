package com.studentmgmt.student.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.student.event.StudentChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class StudentChangedProducer {

    private static final Logger log = LoggerFactory.getLogger(StudentChangedProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.student-changed}")
    private String studentChangedTopic;

    public StudentChangedProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(StudentChangedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(studentChangedTopic, String.valueOf(event.getStudentId()), payload);
            log.info("Published to {}: {}", studentChangedTopic, payload);
        } catch (Exception e) {
            log.error("Failed to publish StudentChangedEvent for studentId={}", event.getStudentId(), e);
        }
    }
}
