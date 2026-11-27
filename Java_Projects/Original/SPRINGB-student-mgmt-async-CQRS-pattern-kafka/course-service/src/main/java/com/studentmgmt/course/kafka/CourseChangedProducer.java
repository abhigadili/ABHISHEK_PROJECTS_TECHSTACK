package com.studentmgmt.course.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.event.CourseChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class CourseChangedProducer {

    private static final Logger log = LoggerFactory.getLogger(CourseChangedProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.kafka.topic.course-changed}")
    private String courseChangedTopic;

    public CourseChangedProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(CourseChangedEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(courseChangedTopic, String.valueOf(event.getCourseId()), payload);
            log.info("Published to {}: {}", courseChangedTopic, payload);
        } catch (Exception e) {
            log.error("Failed to publish CourseChangedEvent for courseId={}", event.getCourseId(), e);
        }
    }
}
