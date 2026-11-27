package com.example.enrollment.entity;

import java.util.EnumSet;
import java.util.Set;

public enum EnrollmentStatus {
    PENDING, CONFIRMED, REJECTED, CANCELLED;

    /** Allowed state machine: PENDING -> CONFIRMED | REJECTED, CONFIRMED -> CANCELLED. REJECTED and CANCELLED are terminal. */
    public Set<EnrollmentStatus> allowedNext() {
        return switch (this) {
            case PENDING -> EnumSet.of(CONFIRMED, REJECTED);
            case CONFIRMED -> EnumSet.of(CANCELLED);
            default -> EnumSet.noneOf(EnrollmentStatus.class);
        };
    }
}
