package com.studentmgmt.course.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.command.repository.CourseCommandRepository;
import com.studentmgmt.course.event.EnrollmentRequestedEvent;
import com.studentmgmt.course.event.ValidationResultEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Consumes `enrollment.requested` and answers on `course.validation.result`.
 * Checks CourseCommandRepository (write/source-of-truth), not
 * CourseQueryRepository/Courses_View — same CQRS-correctness rule as
 * student-service's equivalent listener.
 */
@Component
public class EnrollmentRequestedListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentRequestedListener.class);

    private final CourseCommandRepository courseCommandRepository;
    private final ValidationResultProducer validationResultProducer;
    private final ObjectMapper objectMapper;

    public EnrollmentRequestedListener(CourseCommandRepository courseCommandRepository,
                                        ValidationResultProducer validationResultProducer,
                                        ObjectMapper objectMapper) {
        this.courseCommandRepository = courseCommandRepository;
        this.validationResultProducer = validationResultProducer;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.enrollment-requested}")
    public void onEnrollmentRequested(String message) {
        try {
            EnrollmentRequestedEvent event = objectMapper.readValue(message, EnrollmentRequestedEvent.class);
            log.info("Received enrollment.requested: {}", message);

            boolean exists = courseCommandRepository.existsById(event.getCourseId());
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
