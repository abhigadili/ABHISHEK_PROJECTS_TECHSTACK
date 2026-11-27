package com.example.enrollment.dto;

import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.entity.EnrollmentStatus;
import java.time.LocalDateTime;

public record EnrollmentResponse(Long enrollmentId, Long studentId, Long courseId, String studentName, String courseName,
                                 LocalDateTime enrollmentDate, EnrollmentStatus enrollmentStatus, String remarks,
                                 LocalDateTime createdAt, LocalDateTime updatedAt) {

    public static EnrollmentResponse from(Enrollment e) {
        return new EnrollmentResponse(e.getEnrollmentId(), e.getStudentId(), e.getCourseId(), e.getStudentName(), e.getCourseName(),
                e.getEnrollmentDate(), e.getStatus(), e.getRemarks(), e.getCreatedAt(), e.getUpdatedAt());
    }
}
