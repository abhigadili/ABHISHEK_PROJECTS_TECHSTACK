package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record MedicineDispensedEvent(String eventId, Instant occurredAt, Long orderId, Long prescriptionId,
        Long patientId, String patientName, String patientEmail, BigDecimal totalAmount,
        List<Item> items) implements DomainEvent {

    public record Item(String medicineName, Integer quantity, BigDecimal unitPrice) {
    }
}
