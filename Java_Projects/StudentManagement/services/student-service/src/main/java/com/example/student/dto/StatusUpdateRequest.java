package com.example.student.dto;

import com.example.student.entity.StudentStatus;
import jakarta.validation.constraints.NotNull;

public record StatusUpdateRequest(@NotNull StudentStatus status) {
}
