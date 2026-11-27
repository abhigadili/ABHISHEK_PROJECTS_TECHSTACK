package com.example.course.service;

import com.example.events.LowCourseAvailabilityEvent;
import com.example.events.Topics;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Publishes LowCourseAvailability to Kafka only after the seat change has been committed. */
@Component
public class LowAvailabilityPublisher {
    private static final Logger log = LoggerFactory.getLogger(LowAvailabilityPublisher.class);
    private final KafkaTemplate<String, Object> kafka;

    public LowAvailabilityPublisher(KafkaTemplate<String, Object> kafka) { this.kafka = kafka; }

    public record LowAvailabilityDetected(Long courseId, String courseCode, String courseName, int availableSeats, int totalSeats) {}

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onLowAvailability(LowAvailabilityDetected d) {
        var event = new LowCourseAvailabilityEvent(UUID.randomUUID().toString(), d.courseId(), d.courseCode(), d.courseName(),
                d.availableSeats(), d.totalSeats(), Instant.now());
        kafka.send(Topics.COURSE_LOW_AVAILABILITY, String.valueOf(d.courseId()), event).whenComplete((r, ex) -> {
            if (ex != null) log.error("Failed to publish LowCourseAvailability for course {}: {}", d.courseId(), ex.getMessage());
            else log.info("Published LowCourseAvailability course={} available={} (partition {}, offset {})", d.courseId(),
                    d.availableSeats(), r.getRecordMetadata().partition(), r.getRecordMetadata().offset());
        });
    }
}
