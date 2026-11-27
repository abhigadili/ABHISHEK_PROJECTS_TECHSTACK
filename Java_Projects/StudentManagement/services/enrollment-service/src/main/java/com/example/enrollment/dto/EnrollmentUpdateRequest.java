package com.example.enrollment.dto;

import jakarta.validation.constraints.Size;

public record EnrollmentUpdateRequest(@Size(max = 500) String remarks) {
}
