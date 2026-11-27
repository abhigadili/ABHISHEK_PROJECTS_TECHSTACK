package com.studentmgmt.notification.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.notification.event.EnrollmentOutcomeEvent;
import com.studentmgmt.notification.service.EnrollmentOutcomeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/** Subscribed to BOTH outcome topics via one @KafkaListener — the Saga's final consumer. */
@Component
public class EnrollmentOutcomeListener {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentOutcomeListener.class);

    private final EnrollmentOutcomeService enrollmentOutcomeService;
    private final ObjectMapper objectMapper;

    public EnrollmentOutcomeListener(EnrollmentOutcomeService enrollmentOutcomeService, ObjectMapper objectMapper) {
        this.enrollmentOutcomeService = enrollmentOutcomeService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = {"${app.kafka.topic.enrollment-confirmed}", "${app.kafka.topic.enrollment-rejected}"},
            groupId = "${spring.kafka.consumer.group-id}")
    public void onEnrollmentOutcome(String messageJson) throws Exception {
        EnrollmentOutcomeEvent event = objectMapper.readValue(messageJson, EnrollmentOutcomeEvent.class);
        log.info("Received enrollment outcome: enrollmentId={}, status={}", event.getEnrollmentId(), event.getStatus());
        enrollmentOutcomeService.handle(event);
    }
}
