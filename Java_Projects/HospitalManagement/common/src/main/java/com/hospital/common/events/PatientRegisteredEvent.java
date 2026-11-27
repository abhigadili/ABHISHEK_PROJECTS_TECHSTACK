package com.hospital.common.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Published by Patient Service after a successful registration. */
public record PatientRegisteredEvent(String eventId, Instant occurredAt, Long patientId, Long userId, String firstName, String lastName, String email, String phone) implements DomainEvent {
}
