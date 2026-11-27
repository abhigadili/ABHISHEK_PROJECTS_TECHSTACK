package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record AppointmentRescheduledEvent(String eventId, Instant occurredAt, Long appointmentId, Long patientId, String patientName, String patientEmail, Long doctorId, String doctorName, String doctorEmail, LocalDate oldDate, LocalTime oldStartTime, LocalDate newDate, LocalTime newStartTime, LocalTime newEndTime) implements DomainEvent {
}
