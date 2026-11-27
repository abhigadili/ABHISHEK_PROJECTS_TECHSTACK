package com.hospital.records.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.hospital.common.events.*;
import com.hospital.common.kafka.IdempotentEventProcessor;
import com.hospital.records.domain.EntryType;

/** Builds the clinical timeline from events published by the other services. */
@Component
public class RecordEventConsumer {
    private static final String GROUP = "medical-records-service";
    private final IdempotentEventProcessor processor;
    private final RecordService service;

    public RecordEventConsumer(IdempotentEventProcessor processor, RecordService service) {
        this.processor = processor;
        this.service = service;
    }

    @KafkaListener(topics = Topics.PATIENT_REGISTERED, groupId = GROUP)
    public void onPatientRegistered(String payload) {
        processor.handle(payload, PatientRegisteredEvent.class, GROUP + ":patient-registered",
                e -> service.initRecord(e.patientId(), e.firstName() + " " + e.lastName()));
    }

    @KafkaListener(topics = Topics.LAB_REPORT_GENERATED, groupId = GROUP)
    public void onLabReport(String payload) {
        processor.handle(payload, LabReportGeneratedEvent.class, GROUP + ":lab-report", e -> service.addSystemEntry(
                e.patientId(), e.patientName(), EntryType.LAB_REPORT, "Lab report: " + e.testName() + (e.abnormal() ? " (ABNORMAL)" : ""),
                e.summary(), e.doctorId(), "LAB_REPORT", e.reportId()));
    }

    @KafkaListener(topics = Topics.PRESCRIPTION_CREATED, groupId = GROUP)
    public void onPrescription(String payload) {
        processor.handle(payload, PrescriptionCreatedEvent.class, GROUP + ":prescription", e -> {
            StringBuilder sb = new StringBuilder();
            if (e.diagnosis() != null) sb.append("Diagnosis: ").append(e.diagnosis()).append("\n");
            e.items().forEach(i -> sb.append("- ").append(i.medicineName()).append(" ").append(i.dosage()).append(", ").append(i.frequency())
                    .append(", ").append(i.durationDays()).append(" days\n"));
            service.addSystemEntry(e.patientId(), e.patientName(), EntryType.PRESCRIPTION, "Prescription #" + e.prescriptionId() + " by " + e.doctorName(),
                    sb.toString(), e.doctorId(), "PRESCRIPTION", e.prescriptionId());
        });
    }

    @KafkaListener(topics = Topics.APPOINTMENT_COMPLETED, groupId = GROUP)
    public void onAppointmentCompleted(String payload) {
        processor.handle(payload, AppointmentCompletedEvent.class, GROUP + ":appointment-completed", e -> service.addSystemEntry(
                e.patientId(), null, EntryType.VISIT, "Visit with " + e.doctorName() + " on " + e.date(), e.notes(), e.doctorId(),
                "APPOINTMENT", e.appointmentId()));
    }
}
