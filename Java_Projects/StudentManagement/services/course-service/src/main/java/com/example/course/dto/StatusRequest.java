package com.example.course.dto;

import com.example.course.entity.CourseStatus;
import jakarta.validation.constraints.NotNull;

public record StatusRequest(@NotNull CourseStatus status) {
}
