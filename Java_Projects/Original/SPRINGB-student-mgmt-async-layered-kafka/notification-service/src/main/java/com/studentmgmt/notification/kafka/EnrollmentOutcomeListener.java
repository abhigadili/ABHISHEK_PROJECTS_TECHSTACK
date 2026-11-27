package com.studentmgmt.notification.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import com.studentmgmt.notification.service.EnrollmentOutcomeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumes both `enrollment.confirmed` and `enrollment.rejected` — the final
 * step of the async saga. Nothing here ever calls another service
 * synchronously; it only reacts to what already happened.
 */
@Component
public class EnrollmentOutcomeListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeListener.class);

    private final EnrollmentOutcomeService enrollmentOutcomeService;
    private final ObjectMapper objectMapper;

    public EnrollmentOutcomeListener(EnrollmentOutcomeService enrollmentOutcomeService, ObjectMapper objectMapper) {
        this.enrollmentOutcomeService = enrollmentOutcomeService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = {
            "${app.kafka.topic.enrollment-confirmed}",
            "${app.kafka.topic.enrollment-rejected}"
    })
    public void onEnrollmentOutcome(String message) {
        try {
            EnrollmentOutcomeEvent event = objectMapper.readValue(message, EnrollmentOutcomeEvent.class);
            log.info("Received enrollment outcome: {}", message);
            enrollmentOutcomeService.handle(event);
        } catch (Exception e) {
            log.error("Failed to process enrollment outcome message: {}", message, e);
        }
    }
}
