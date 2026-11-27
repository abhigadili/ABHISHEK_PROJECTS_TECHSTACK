package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record LabTestRequestedEvent(String eventId, Instant occurredAt, Long requestId, Long patientId, String patientName, String patientEmail, Long doctorId, String testCode, String testName, BigDecimal price, String priority) implements DomainEvent {
}
