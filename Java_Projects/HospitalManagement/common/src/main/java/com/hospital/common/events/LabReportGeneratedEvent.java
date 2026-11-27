package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record LabReportGeneratedEvent(String eventId, Instant occurredAt, Long reportId, Long requestId, Long patientId, String patientName, String patientEmail, Long doctorId, String testName, String summary, boolean abnormal) implements DomainEvent {
}
