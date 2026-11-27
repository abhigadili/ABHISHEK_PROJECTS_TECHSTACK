package com.example.course.dto;

import com.example.course.entity.CourseStatus;
import com.example.course.validation.ValidCourseCode;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record CourseRequest(
        @NotBlank @Size(max = 120) String courseName,
        @ValidCourseCode String courseCode,
        @Size(max = 5000) String description,
        Long categoryId,
        @NotNull @Min(1) @Max(520) Integer durationWeeks,
        @NotNull @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal fees,
        @NotNull @Min(0) @Max(100000) Integer totalSeats,
        CourseStatus status) {
}
