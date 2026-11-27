package com.example.events;

import java.time.Instant;

/** Published by Course Service when a course's available seats fall to/below the configured threshold. */
public record LowCourseAvailabilityEvent(
        String eventId,
        Long courseId,
        String courseCode,
        String courseName,
        int availableSeats,
        int totalSeats,
        Instant occurredAt) {
}
