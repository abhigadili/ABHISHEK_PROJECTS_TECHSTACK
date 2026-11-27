package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record AppointmentCompletedEvent(String eventId, Instant occurredAt, Long appointmentId, Long patientId, Long doctorId, String doctorName, LocalDate date, String notes) implements DomainEvent {
}
