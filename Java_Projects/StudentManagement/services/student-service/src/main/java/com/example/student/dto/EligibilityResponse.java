package com.example.student.dto;

public record EligibilityResponse(Long studentId, boolean eligible, String reason) {
}
