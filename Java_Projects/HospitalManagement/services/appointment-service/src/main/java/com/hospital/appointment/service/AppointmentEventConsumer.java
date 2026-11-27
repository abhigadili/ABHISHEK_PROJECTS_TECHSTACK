package com.hospital.appointment.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hospital.appointment.domain.PaymentStatus;
import com.hospital.common.events.BillingGeneratedEvent;
import com.hospital.common.events.PaymentCompletedEvent;
import com.hospital.common.events.PaymentFailedEvent;
import com.hospital.common.events.Topics;
import com.hospital.common.kafka.IdempotentEventProcessor;

/** Keeps the appointment's payment status in sync with Billing - purely event driven, no synchronous coupling. */
@Component
public class AppointmentEventConsumer {
    private static final String GROUP = "appointment-service";
    private final IdempotentEventProcessor processor;
    private final AppointmentService service;

    public AppointmentEventConsumer(IdempotentEventProcessor processor, AppointmentService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.BILLING_GENERATED, groupId = GROUP)
    public void onBillingGenerated(String payload) {
        processor.handle(payload, BillingGeneratedEvent.class, GROUP + ":billing-generated", e -> {
            if ("APPOINTMENT".equals(e.referenceType())) service.applyBilling(e.referenceId(), e.billNumber(), PaymentStatus.PENDING);
        });
    }

    @KafkaListener(topics = Topics.PAYMENT_COMPLETED, groupId = GROUP)
    public void onPaymentCompleted(String payload) {
        processor.handle(payload, PaymentCompletedEvent.class, GROUP + ":payment-completed", e -> {
            if ("APPOINTMENT".equals(e.referenceType())) service.applyBilling(e.referenceId(), e.billNumber(), PaymentStatus.PAID);
        });
    }

    @KafkaListener(topics = Topics.PAYMENT_FAILED, groupId = GROUP)
    public void onPaymentFailed(String payload) {
        processor.handle(payload, PaymentFailedEvent.class, GROUP + ":payment-failed", e -> {
            if ("APPOINTMENT".equals(e.referenceType())) service.applyBilling(e.referenceId(), e.billNumber(), PaymentStatus.FAILED);
        });
    }
}
