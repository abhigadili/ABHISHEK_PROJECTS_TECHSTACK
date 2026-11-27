package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.ValidationResultEvent;
import com.studentmgmt.enrollment.service.EnrollmentSagaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class CourseValidationResultListener {

    private static final Logger log = LoggerFactory.getLogger(CourseValidationResultListener.class);

    private final EnrollmentSagaService enrollmentSagaService;
    private final ObjectMapper objectMapper;

    public CourseValidationResultListener(EnrollmentSagaService enrollmentSagaService, ObjectMapper objectMapper) {
        this.enrollmentSagaService = enrollmentSagaService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.course-validation-result}", groupId = "${spring.kafka.consumer.group-id}")
    public void onCourseValidationResult(String messageJson) throws Exception {
        ValidationResultEvent event = objectMapper.readValue(messageJson, ValidationResultEvent.class);
        log.info("Received course.validation.result: enrollmentId={}, valid={}", event.getEnrollmentId(), event.isValid());
        enrollmentSagaService.applyCourseValidationResult(event.getEnrollmentId(), event.isValid(), event.getReason());
    }
}
