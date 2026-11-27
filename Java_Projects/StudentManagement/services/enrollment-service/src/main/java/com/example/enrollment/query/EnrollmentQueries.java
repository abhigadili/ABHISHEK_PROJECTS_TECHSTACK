package com.example.enrollment.query;

import com.example.enrollment.entity.EnrollmentStatus;
import java.time.LocalDate;
import org.springframework.data.domain.Pageable;

/** Query objects (read side of CQRS). */
public final class EnrollmentQueries {
    private EnrollmentQueries() {}

    public record GetEnrollmentQuery(Long enrollmentId) {}

    public record SearchEnrollmentsQuery(Long studentId, Long courseId, EnrollmentStatus status, LocalDate from, LocalDate to, Pageable pageable) {}

    public record StudentEnrollmentHistoryQuery(Long studentId, Pageable pageable) {}

    public record CourseEnrollmentsQuery(Long courseId, EnrollmentStatus status, Pageable pageable) {}
}
