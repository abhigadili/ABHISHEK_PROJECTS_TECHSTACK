package com.example.notification.consumer;

import com.example.events.EnrollmentEvent;
import com.example.events.LowCourseAvailabilityEvent;
import com.example.events.Topics;
import com.example.notification.service.NotificationIngestService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Kafka consumers (group "notification-service"). A thrown exception makes the container's DefaultErrorHandler retry with
 * back-off and finally publish the record to "<topic>.DLT"; the offset is committed only after the listener returns.
 */
@Component
public class EventConsumers {
    private static final Logger log = LoggerFactory.getLogger(EventConsumers.class);
    private final NotificationIngestService ingest;

    public EventConsumers(NotificationIngestService ingest) { this.ingest = ingest; }

    @KafkaListener(id = "enrollment-events",
            topics = {Topics.ENROLLMENT_REQUESTED, Topics.ENROLLMENT_CONFIRMED, Topics.ENROLLMENT_REJECTED, Topics.ENROLLMENT_CANCELLED},
            properties = "spring.json.value.default.type:com.example.events.EnrollmentEvent")
    public void onEnrollmentEvent(ConsumerRecord<String, EnrollmentEvent> record) {
        EnrollmentEvent e = record.value();
        log.info("Consumed {} eventId={} enrollment={} [{}-{}@{}]", e.eventType(), e.eventId(), e.enrollmentId(),
                record.topic(), record.partition(), record.offset());
        ingest.handleEnrollmentEvent(e, record.topic());
    }

    @KafkaListener(id = "course-availability-events", topics = Topics.COURSE_LOW_AVAILABILITY,
            properties = "spring.json.value.default.type:com.example.events.LowCourseAvailabilityEvent")
    public void onLowAvailability(ConsumerRecord<String, LowCourseAvailabilityEvent> record) {
        LowCourseAvailabilityEvent e = record.value();
        log.info("Consumed LowCourseAvailability eventId={} course={} available={}", e.eventId(), e.courseId(), e.availableSeats());
        ingest.handleLowAvailability(e, record.topic());
    }
}
