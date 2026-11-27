package com.studentmgmt.course.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.event.EnrollmentRequestedEvent;
import com.studentmgmt.course.event.ValidationResultEvent;
import com.studentmgmt.course.repository.CourseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Consumes `enrollment.requested` (published by enrollment-service) and answers
 * asynchronously on `course.validation.result` — this listener is the
 * replacement for the old synchronous CourseFeignClient.exists() call.
 */
@Component
public class EnrollmentRequestedListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentRequestedListener.class);

    private final CourseRepository courseRepository;
    private final ValidationResultProducer validationResultProducer;
    private final ObjectMapper objectMapper;

    public EnrollmentRequestedListener(CourseRepository courseRepository,
                                        ValidationResultProducer validationResultProducer,
                                        ObjectMapper objectMapper) {
        this.courseRepository = courseRepository;
        this.validationResultProducer = validationResultProducer;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.enrollment-requested}")
    public void onEnrollmentRequested(String message) {
        try {
            EnrollmentRequestedEvent event = objectMapper.readValue(message, EnrollmentRequestedEvent.class);
            log.info("Received enrollment.requested: {}", message);

            boolean exists = courseRepository.existsById(event.getCourseId());
            String reason = exists
                    ? "Course " + event.getCourseId() + " exists"
                    : "Course " + event.getCourseId() + " does not exist in CourseDB";

            validationResultProducer.publish(new ValidationResultEvent(
                    event.getEnrollmentId(), exists, reason, "course-service", LocalDateTime.now().toString()));
        } catch (Exception e) {
            log.error("Failed to process enrollment.requested message: {}", message, e);
        }
    }
}
