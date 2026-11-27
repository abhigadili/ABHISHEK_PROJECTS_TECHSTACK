package com.studentmgmt.student.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.student.event.EnrollmentRequestedEvent;
import com.studentmgmt.student.event.ValidationResultEvent;
import com.studentmgmt.student.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * This service's half of the choreography Saga: react to a new enrollment
 * request by checking whether the student actually exists, then reply on
 * `student.validation.result`. Nobody calls this method directly — Spring
 * Kafka invokes it automatically because of @KafkaListener, on a background
 * thread that has been idle since this service started.
 */
@Component
public class EnrollmentRequestedListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentRequestedListener.class);

    private final StudentRepository studentRepository;
    private final ValidationResultProducer validationResultProducer;
    private final ObjectMapper objectMapper;

    public EnrollmentRequestedListener(StudentRepository studentRepository,
                                        ValidationResultProducer validationResultProducer,
                                        ObjectMapper objectMapper) {
        this.studentRepository = studentRepository;
        this.validationResultProducer = validationResultProducer;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.enrollment-requested}", groupId = "${spring.kafka.consumer.group-id}")
    public void onEnrollmentRequested(String messageJson) throws Exception {
        EnrollmentRequestedEvent event = objectMapper.readValue(messageJson, EnrollmentRequestedEvent.class);
        log.info("Received enrollment.requested: enrollmentId={}, studentId={}",
                event.getEnrollmentId(), event.getStudentId());

        boolean exists = studentRepository.existsById(event.getStudentId());
        String reason = exists ? "Student " + event.getStudentId() + " exists"
                                : "Student " + event.getStudentId() + " does not exist";

        ValidationResultEvent result = new ValidationResultEvent(
                event.getEnrollmentId(), exists, reason, "student-service", LocalDateTime.now().toString());
        validationResultProducer.publish(result);
    }
}
