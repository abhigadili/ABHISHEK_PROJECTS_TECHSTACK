package com.example.course.dto;

import com.example.course.entity.CourseStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CourseResponse(Long courseId, String courseName, String courseCode, String description, Long categoryId,
                             String categoryName, int durationWeeks, BigDecimal fees, int totalSeats, int availableSeats,
                             CourseStatus status, LocalDateTime createdAt, LocalDateTime updatedAt) {
}
