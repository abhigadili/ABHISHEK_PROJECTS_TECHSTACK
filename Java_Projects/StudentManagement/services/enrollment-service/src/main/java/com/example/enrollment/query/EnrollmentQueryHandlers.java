package com.example.enrollment.query;

import com.example.common.exception.ResourceNotFoundException;
import com.example.enrollment.dto.EnrollmentResponse;
import com.example.enrollment.query.EnrollmentQueries.*;
import com.example.enrollment.repository.EnrollmentRepository;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Read-side handlers: never mutate state, never call other services. */
@Component
@Transactional(readOnly = true)
public class EnrollmentQueryHandlers {
    private final EnrollmentRepository enrollments;

    public EnrollmentQueryHandlers(EnrollmentRepository enrollments) { this.enrollments = enrollments; }

    public EnrollmentResponse handle(GetEnrollmentQuery q) {
        return enrollments.findById(q.enrollmentId()).map(EnrollmentResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment " + q.enrollmentId() + " not found"));
    }

    public Page<EnrollmentResponse> handle(SearchEnrollmentsQuery q) {
        return enrollments.findAll(EnrollmentSpecifications.filter(q.studentId(), q.courseId(), q.status(), q.from(), q.to()), q.pageable())
                .map(EnrollmentResponse::from);
    }

    public Page<EnrollmentResponse> handle(StudentEnrollmentHistoryQuery q) {
        return enrollments.findAll(EnrollmentSpecifications.filter(q.studentId(), null, null, null, null), q.pageable()).map(EnrollmentResponse::from);
    }

    public Page<EnrollmentResponse> handle(CourseEnrollmentsQuery q) {
        return enrollments.findAll(EnrollmentSpecifications.filter(null, q.courseId(), q.status(), null, null), q.pageable()).map(EnrollmentResponse::from);
    }
}
