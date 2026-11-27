package com.example.course.dto;

import com.example.course.entity.CourseStatus;

public record CourseAvailabilityResponse(Long courseId, CourseStatus status, int totalSeats, int availableSeats, boolean available) {
}
