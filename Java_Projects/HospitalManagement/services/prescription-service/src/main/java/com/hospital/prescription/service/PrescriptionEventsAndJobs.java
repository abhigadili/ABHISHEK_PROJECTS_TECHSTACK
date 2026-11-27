package com.hospital.prescription.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.hospital.common.events.MedicineDispensedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.IdempotentEventProcessor;

import lombok.extern.log4j.Log4j2;

/** Kafka consumer (MedicineDispensed -> status tracking) and the scheduled expiry sweep. */
@Log4j2
@Component
public class PrescriptionEventsAndJobs {
    private static final String GROUP = "prescription-service";
    private final IdempotentEventProcessor processor;
    private final PrescriptionService service;

    public PrescriptionEventsAndJobs(IdempotentEventProcessor processor, PrescriptionService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.MEDICINE_DISPENSED, groupId = GROUP)
    public void onMedicineDispensed(String payload) {
        processor.handle(payload, MedicineDispensedEvent.class, GROUP + ":medicine-dispensed", service::markDispensed);
    }

    @Scheduled(fixedDelayString = "${hospital.scheduler.expiry.fixed-delay-ms:600000}", initialDelayString = "${hospital.scheduler.initial-delay-ms:30000}")
    public void expirePrescriptions() {
        int n = service.expireOverdue();
        if (n > 0) log.info("Prescription expiry job: {} prescription(s) expired", n);
    }
}
