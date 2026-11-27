package com.example.enrollment.command;

public record CancelEnrollmentCommand(Long enrollmentId, String reason) {
}
