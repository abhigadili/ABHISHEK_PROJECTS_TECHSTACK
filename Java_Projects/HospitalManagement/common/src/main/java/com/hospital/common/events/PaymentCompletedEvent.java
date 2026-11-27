package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record PaymentCompletedEvent(String eventId, Instant occurredAt, Long billId, String billNumber, String transactionRef, Long patientId, String patientName, String patientEmail, String referenceType, Long referenceId, BigDecimal amount) implements DomainEvent {
}
