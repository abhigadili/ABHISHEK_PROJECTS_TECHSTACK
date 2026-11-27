package com.example.enrollment.command;

import com.example.enrollment.dto.EnrollmentResponse;

/** Result of CreateEnrollmentCommand: CONFIRMED, REJECTED (with reason), or IN_PROGRESS (saga paused; it will be resumed). */
public record EnrollmentOutcome(String result, String message, EnrollmentResponse enrollment) {
    public static final String CONFIRMED = "CONFIRMED";
    public static final String REJECTED = "REJECTED";
    public static final String IN_PROGRESS = "IN_PROGRESS";
}
