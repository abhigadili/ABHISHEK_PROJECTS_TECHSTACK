package com.example.enrollment.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Minimal consumer-side views of the other services' API responses (not shared with their entities). */
public final class RemoteDtos {
    private RemoteDtos() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StudentInfo(Long studentId, String firstName, String lastName, String email, String status) {
        public String fullName() { return (firstName + " " + lastName).trim(); }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EligibilityInfo(Long studentId, boolean eligible, String reason) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CourseInfo(Long courseId, String courseName, String courseCode, String status, int totalSeats, int availableSeats) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AvailabilityInfo(Long courseId, String status, int totalSeats, int availableSeats, boolean available) {}

    public record SeatCommand(Long enrollmentId) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SeatResult(Long courseId, Long enrollmentId, String reservationStatus, int availableSeats, boolean replayed) {}
}
