package com.example.events;

import java.time.Instant;

/**
 * Integration event published by Enrollment Service (EnrollmentRequested / Confirmed / Rejected / Cancelled).
 * Intentionally independent of any JPA entity. {@code eventId} is the idempotency key for consumers.
 */
public record EnrollmentEvent(
        String eventId,
        EnrollmentEventType eventType,
        Long enrollmentId,
        Long studentId,
        Long courseId,
        String studentName,
        String studentEmail,
        String courseName,
        String reason,
        String correlationId,
        Instant occurredAt) {
}
