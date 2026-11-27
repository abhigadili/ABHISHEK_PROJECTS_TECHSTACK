package com.example.course.dto;

import jakarta.validation.constraints.NotNull;

public final class SeatDtos {
    private SeatDtos() {}

    public record SeatRequest(@NotNull Long enrollmentId) {}

    /** {@code replayed=true} means the same enrollmentId had already performed this operation (idempotent no-op). */
    public record SeatResponse(Long courseId, Long enrollmentId, String reservationStatus, int availableSeats, boolean replayed) {}
}
