package com.example.enrollment.command;

/** Command: request an enrollment. {@code idempotencyKey} makes retries of the same request return the same result. */
public record CreateEnrollmentCommand(Long studentId, Long courseId, String idempotencyKey, String correlationId) {
}
