package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record PrescriptionCreatedEvent(String eventId, Instant occurredAt, Long prescriptionId, Long patientId,
        String patientName, String patientEmail, Long doctorId, String doctorName, LocalDate validUntil,
        String diagnosis, List<Item> items) implements DomainEvent {

    public record Item(String medicineName, String dosage, String frequency, Integer durationDays, Integer quantity) {
    }
}
