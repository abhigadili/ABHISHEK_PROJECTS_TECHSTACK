package com.hospital.notification.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hospital.common.events.*;
import com.hospital.common.kafka.IdempotentEventProcessor;
import com.hospital.notification.domain.Notification.Channel;

/** Turns business events from every other service into patient / doctor notifications. */
@Component
public class NotificationEventConsumer {
    private static final String GROUP = "notification-service";
    private final IdempotentEventProcessor processor;
    private final NotificationService service;

    public NotificationEventConsumer(IdempotentEventProcessor processor, NotificationService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.PATIENT_REGISTERED, groupId = GROUP)
    public void onPatientRegistered(String payload) {
        processor.handle(payload, PatientRegisteredEvent.class, GROUP + ":patient-registered", e -> service.send(e.email(), e.phone(), Channel.EMAIL,
                "Welcome to the hospital", "Hello " + e.firstName() + " " + e.lastName() + ", your patient registration is complete. Your patient id is " + e.patientId() + ".",
                "PATIENT_REGISTERED", String.valueOf(e.patientId())));
    }

    @KafkaListener(topics = Topics.APPOINTMENT_BOOKED, groupId = GROUP)
    public void onAppointmentBooked(String payload) {
        processor.handle(payload, AppointmentBookedEvent.class, GROUP + ":appointment-booked", e -> {
            String ref = String.valueOf(e.appointmentId());
            service.send(e.patientEmail(), null, Channel.EMAIL, "Appointment confirmed",
                    "Your appointment with " + e.doctorName() + " is confirmed for " + e.date() + " " + e.startTime() + "-" + e.endTime() + ". Consultation fee: " + e.fee() + ".",
                    "APPOINTMENT_BOOKED", ref);
            service.send(e.doctorEmail(), null, Channel.EMAIL, "New appointment",
                    "New appointment with patient " + e.patientName() + " on " + e.date() + " " + e.startTime() + "-" + e.endTime() + ".", "APPOINTMENT_BOOKED", ref);
        });
    }

    @KafkaListener(topics = Topics.APPOINTMENT_CANCELLED, groupId = GROUP)
    public void onAppointmentCancelled(String payload) {
        processor.handle(payload, AppointmentCancelledEvent.class, GROUP + ":appointment-cancelled", e -> {
            String ref = String.valueOf(e.appointmentId());
            String why = e.reason() == null ? "" : " Reason: " + e.reason() + ".";
            service.send(e.patientEmail(), null, Channel.EMAIL, "Appointment cancelled",
                    "Your appointment with " + e.doctorName() + " on " + e.date() + " " + e.startTime() + " was cancelled by " + e.cancelledBy() + "." + why, "APPOINTMENT_CANCELLED", ref);
            service.send(e.doctorEmail(), null, Channel.EMAIL, "Appointment cancelled",
                    "The appointment with " + e.patientName() + " on " + e.date() + " " + e.startTime() + " was cancelled." + why, "APPOINTMENT_CANCELLED", ref);
        });
    }

    @KafkaListener(topics = Topics.APPOINTMENT_RESCHEDULED, groupId = GROUP)
    public void onAppointmentRescheduled(String payload) {
        processor.handle(payload, AppointmentRescheduledEvent.class, GROUP + ":appointment-rescheduled", e -> {
            String ref = String.valueOf(e.appointmentId());
            String msg = "moved from " + e.oldDate() + " " + e.oldStartTime() + " to " + e.newDate() + " " + e.newStartTime() + "-" + e.newEndTime();
            service.send(e.patientEmail(), null, Channel.EMAIL, "Appointment rescheduled", "Your appointment with " + e.doctorName() + " was " + msg + ".", "APPOINTMENT_RESCHEDULED", ref);
            service.send(e.doctorEmail(), null, Channel.EMAIL, "Appointment rescheduled", "Appointment with " + e.patientName() + " was " + msg + ".", "APPOINTMENT_RESCHEDULED", ref);
        });
    }

    @KafkaListener(topics = Topics.LAB_REPORT_GENERATED, groupId = GROUP)
    public void onLabReport(String payload) {
        processor.handle(payload, LabReportGeneratedEvent.class, GROUP + ":lab-report", e -> service.send(e.patientEmail(), null, Channel.EMAIL,
                "Lab report ready", "Your report for '" + e.testName() + "' is ready" + (e.abnormal() ? " (please consult your doctor: results flagged abnormal)" : "") + ".",
                "LAB_REPORT_GENERATED", String.valueOf(e.reportId())));
    }

    @KafkaListener(topics = Topics.PRESCRIPTION_CREATED, groupId = GROUP)
    public void onPrescription(String payload) {
        processor.handle(payload, PrescriptionCreatedEvent.class, GROUP + ":prescription", e -> service.send(e.patientEmail(), null, Channel.EMAIL,
                "New prescription", e.doctorName() + " issued prescription #" + e.prescriptionId() + " with " + e.items().size() + " medicine(s), valid until " + e.validUntil() + ".",
                "PRESCRIPTION_CREATED", String.valueOf(e.prescriptionId())));
    }

    @KafkaListener(topics = Topics.BILLING_GENERATED, groupId = GROUP)
    public void onBill(String payload) {
        processor.handle(payload, BillingGeneratedEvent.class, GROUP + ":billing-generated", e -> service.send(e.patientEmail(), null, Channel.EMAIL,
                "New bill " + e.billNumber(), "A bill of " + e.amount() + " (" + e.billType() + ") has been generated, due " + e.dueDate() + ".", "BILLING_GENERATED", String.valueOf(e.billId())));
    }

    @KafkaListener(topics = Topics.PAYMENT_COMPLETED, groupId = GROUP)
    public void onPaymentCompleted(String payload) {
        processor.handle(payload, PaymentCompletedEvent.class, GROUP + ":payment-completed", e -> service.send(e.patientEmail(), null, Channel.EMAIL,
                "Payment received", "We received your payment of " + e.amount() + " for bill " + e.billNumber() + " (transaction " + e.transactionRef() + "). Thank you.",
                "PAYMENT_COMPLETED", e.transactionRef()));
    }

    @KafkaListener(topics = Topics.PAYMENT_FAILED, groupId = GROUP)
    public void onPaymentFailed(String payload) {
        processor.handle(payload, PaymentFailedEvent.class, GROUP + ":payment-failed", e -> service.send(e.patientEmail(), null, Channel.EMAIL,
                "Payment failed", "Your payment of " + e.amount() + " for bill " + e.billNumber() + " failed: " + e.reason() + ". You can retry from your bills page.",
                "PAYMENT_FAILED", e.transactionRef()));
    }

    @KafkaListener(topics = Topics.MEDICINE_DISPENSED, groupId = GROUP)
    public void onDispensed(String payload) {
        processor.handle(payload, MedicineDispensedEvent.class, GROUP + ":medicine-dispensed", e -> service.send(e.patientEmail(), null, Channel.EMAIL,
                "Medicines dispensed", "Your medicines for prescription #" + e.prescriptionId() + " have been dispensed (total " + e.totalAmount() + ").", "MEDICINE_DISPENSED", String.valueOf(e.orderId())));
    }

    /** Reminders and alerts raised by the schedulers of other services. */
    @KafkaListener(topics = Topics.NOTIFICATION_REQUESTED, groupId = GROUP)
    public void onRequested(String payload) {
        processor.handle(payload, NotificationRequestedEvent.class, GROUP + ":notification-requested", e -> service.send(e.recipientEmail(), e.recipientPhone(),
                "SMS".equalsIgnoreCase(e.channel()) ? Channel.SMS : Channel.EMAIL, e.subject(), e.message(), e.eventType(), e.referenceId()));
    }
}
