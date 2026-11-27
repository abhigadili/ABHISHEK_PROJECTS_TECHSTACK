package com.hospital.pharmacy.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.hospital.common.events.NotificationRequestedEvent;
import com.hospital.common.events.PrescriptionCreatedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.EventPublisher;
import com.hospital.common.kafka.IdempotentEventProcessor;
import com.hospital.pharmacy.domain.Medicine;
import com.hospital.pharmacy.domain.MedicineRepository;

import lombok.extern.log4j.Log4j2;

/** PrescriptionCreated consumer + low-stock scheduler. */
@Log4j2
@Component
public class PharmacyEventsAndJobs {
    private static final String GROUP = "pharmacy-service";
    private final IdempotentEventProcessor processor;
    private final PharmacyService service;
    private final MedicineRepository medicines;
    private final EventPublisher events;
    private final TransactionTemplate tx;
    private final String alertEmail;
    private final Duration alertInterval;

    public PharmacyEventsAndJobs(IdempotentEventProcessor processor, PharmacyService service, MedicineRepository medicines, EventPublisher events,
                                 TransactionTemplate tx, @Value("${hospital.pharmacy.alert-email}") String alertEmail,
                                 @Value("${hospital.pharmacy.alert-interval-hours:24}") long alertHours) {
        this.processor = processor;
        this.service = service;
        this.medicines = medicines;
        this.events = events;
        this.tx = tx;
        this.alertEmail = alertEmail;
        this.alertInterval = Duration.ofHours(alertHours);
    }

    @KafkaListener(topics = Topics.PRESCRIPTION_CREATED, groupId = GROUP)
    public void onPrescriptionCreated(String payload) {
        processor.handle(payload, PrescriptionCreatedEvent.class, GROUP + ":prescription-created", service::openOrder);
    }

    /** Raises one NotificationRequested per low-stock medicine per alert interval. */
    @Scheduled(fixedDelayString = "${hospital.scheduler.low-stock.fixed-delay-ms:600000}", initialDelayString = "${hospital.scheduler.initial-delay-ms:30000}")
    public void lowStockAlerts() {
        tx.executeWithoutResult(s -> {
            Instant now = Instant.now();
            List<Medicine> low = medicines.findLowStockNeedingAlert(now.minus(alertInterval));
            for (Medicine m : low) {
                events.publish(Topics.NOTIFICATION_REQUESTED, "low-stock-" + m.getId(), new NotificationRequestedEvent(EventPublisher.newId(), now,
                        alertEmail, null, "EMAIL", "Low stock: " + m.getName(),
                        m.getName() + " (" + m.getSku() + ") has only " + m.getStockQuantity() + " unit(s) left (reorder level " + m.getReorderLevel() + ").",
                        "LOW_STOCK", String.valueOf(m.getId())));
                m.setLastLowStockAlertAt(now);
            }
            if (!low.isEmpty()) log.info("Low-stock job: {} alert(s) queued", low.size());
        });
    }
}
