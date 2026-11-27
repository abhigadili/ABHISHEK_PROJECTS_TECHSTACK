package com.studentmgmt.student.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.student.dao.StudentDao;
import com.studentmgmt.student.event.EnrollmentRequestedEvent;
import com.studentmgmt.student.event.ValidationResultEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Consumes `enrollment.requested` (published by enrollment-service) and answers
 * asynchronously on `student.validation.result` — this listener is the
 * replacement for the old synchronous StudentFeignClient.exists() call.
 */
@Component
public class EnrollmentRequestedListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentRequestedListener.class);

    private final StudentDao studentDao;
    private final ValidationResultProducer validationResultProducer;
    private final ObjectMapper objectMapper;

    public EnrollmentRequestedListener(StudentDao studentDao,
                                        ValidationResultProducer validationResultProducer,
                                        ObjectMapper objectMapper) {
        this.studentDao = studentDao;
        this.validationResultProducer = validationResultProducer;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.enrollment-requested}")
    public void onEnrollmentRequested(String message) {
        try {
            EnrollmentRequestedEvent event = objectMapper.readValue(message, EnrollmentRequestedEvent.class);
            log.info("Received enrollment.requested: {}", message);

            boolean exists = studentDao.existsById(event.getStudentId());
            String reason = exists
                    ? "Student " + event.getStudentId() + " exists"
                    : "Student " + event.getStudentId() + " does not exist in StudentDB";

            validationResultProducer.publish(new ValidationResultEvent(
                    event.getEnrollmentId(), exists, reason, "student-service", LocalDateTime.now().toString()));
        } catch (Exception e) {
            log.error("Failed to process enrollment.requested message: {}", message, e);
        }
    }
}
