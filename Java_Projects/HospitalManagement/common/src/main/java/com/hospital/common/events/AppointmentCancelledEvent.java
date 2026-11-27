package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record AppointmentCancelledEvent(String eventId, Instant occurredAt, Long appointmentId, Long patientId, String patientName, String patientEmail, Long doctorId, String doctorName, String doctorEmail, LocalDate date, LocalTime startTime, String cancelledBy, String reason) implements DomainEvent {
}
