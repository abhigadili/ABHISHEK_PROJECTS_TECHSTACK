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
 * course-service's half of the choreography Saga — mirrors student-service's
 * EnrollmentRequestedListener. Both listeners react to the SAME
 * `enrollment.requested` message independently (they're in different Kafka
 * consumer groups), which is why enrollment-service must wait for BOTH
 * validation replies before resolving the saga — see EnrollmentSagaService.
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

    @KafkaListener(topics = "${app.kafka.topic.enrollment-requested}", groupId = "${spring.kafka.consumer.group-id}")
    public void onEnrollmentRequested(String messageJson) throws Exception {
        EnrollmentRequestedEvent event = objectMapper.readValue(messageJson, EnrollmentRequestedEvent.class);
        log.info("Received enrollment.requested: enrollmentId={}, courseId={}",
                event.getEnrollmentId(), event.getCourseId());

        boolean exists = courseRepository.existsById(event.getCourseId());
        String reason = exists ? "Course " + event.getCourseId() + " exists"
                                : "Course " + event.getCourseId() + " does not exist";

        ValidationResultEvent result = new ValidationResultEvent(
                event.getEnrollmentId(), exists, reason, "course-service", LocalDateTime.now().toString());
        validationResultProducer.publish(result);
    }
}
