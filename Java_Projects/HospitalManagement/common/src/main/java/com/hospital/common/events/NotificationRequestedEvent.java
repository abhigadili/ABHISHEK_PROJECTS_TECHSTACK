package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Generic request raised by schedulers (reminders, alerts). */
public record NotificationRequestedEvent(String eventId, Instant occurredAt, String recipientEmail, String recipientPhone, String channel, String subject, String message, String eventType, String referenceId) implements DomainEvent {
}
