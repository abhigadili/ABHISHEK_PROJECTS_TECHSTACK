package com.hospital.laboratory.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hospital.common.events.LabTestRequestedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.IdempotentEventProcessor;

/** The Laboratory Service is notified of new work through Kafka (decoupled from the request transaction). */
@Component
public class LabEventConsumer {
    private static final String GROUP = "laboratory-service";
    private final IdempotentEventProcessor processor;
    private final LabService service;

    public LabEventConsumer(IdempotentEventProcessor processor, LabService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.LAB_TEST_REQUESTED, groupId = GROUP)
    public void onLabTestRequested(String payload) {
        processor.handle(payload, LabTestRequestedEvent.class, GROUP + ":lab-test-requested", e -> service.enqueue(e.requestId()));
    }
}
