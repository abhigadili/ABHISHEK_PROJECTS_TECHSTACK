package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record BillingGeneratedEvent(String eventId, Instant occurredAt, Long billId, String billNumber, Long patientId, String patientName, String patientEmail, String billType, String referenceType, Long referenceId, BigDecimal amount, LocalDate dueDate) implements DomainEvent {
}
