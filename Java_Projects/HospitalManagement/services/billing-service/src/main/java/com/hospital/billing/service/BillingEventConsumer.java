package com.hospital.billing.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hospital.billing.domain.BillType;
import com.hospital.common.events.*;
import com.hospital.common.kafka.IdempotentEventProcessor;

/** Billing reacts to business events - it never has to be called synchronously by the other services. */
@Component
public class BillingEventConsumer {
    private static final String GROUP = "billing-service";
    private final IdempotentEventProcessor processor;
    private final BillingService service;

    public BillingEventConsumer(IdempotentEventProcessor processor, BillingService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.APPOINTMENT_BOOKED, groupId = GROUP)
    public void onAppointmentBooked(String payload) {
        processor.handle(payload, AppointmentBookedEvent.class, GROUP + ":appointment-booked", e -> service.generateFromEvent(
                BillType.APPOINTMENT, "APPOINTMENT", e.appointmentId(), e.patientId(), e.patientName(), e.patientEmail(),
                "Consultation with " + e.doctorName() + " on " + e.date() + " " + e.startTime(), e.fee(), 1));
    }

    @KafkaListener(topics = Topics.APPOINTMENT_CANCELLED, groupId = GROUP)
    public void onAppointmentCancelled(String payload) {
        processor.handle(payload, AppointmentCancelledEvent.class, GROUP + ":appointment-cancelled", e -> service.onAppointmentCancelled(e.appointmentId()));
    }

    @KafkaListener(topics = Topics.LAB_TEST_REQUESTED, groupId = GROUP)
    public void onLabTestRequested(String payload) {
        processor.handle(payload, LabTestRequestedEvent.class, GROUP + ":lab-test-requested", e -> service.generateFromEvent(
                BillType.LAB, "LAB_REQUEST", e.requestId(), e.patientId(), e.patientName(), e.patientEmail(), "Lab test: " + e.testName() + " (" + e.testCode() + ")", e.price(), 1));
    }

    @KafkaListener(topics = Topics.MEDICINE_DISPENSED, groupId = GROUP)
    public void onMedicineDispensed(String payload) {
        processor.handle(payload, MedicineDispensedEvent.class, GROUP + ":medicine-dispensed", service::generateMedicineBill);
    }
}
