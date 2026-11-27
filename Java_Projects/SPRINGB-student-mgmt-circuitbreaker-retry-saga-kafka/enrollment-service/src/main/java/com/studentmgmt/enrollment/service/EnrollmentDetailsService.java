package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.client.CourseServiceClient;
import com.studentmgmt.enrollment.client.StudentServiceClient;
import com.studentmgmt.enrollment.dto.CourseSummary;
import com.studentmgmt.enrollment.dto.EnrollmentDetails;
import com.studentmgmt.enrollment.dto.StudentSummary;
import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.repository.EnrollmentStatusRepository;
import org.springframework.stereotype.Service;

/**
 * Backs GET /api/enrollments/{id}/details — the one endpoint in this system
 * that calls two OTHER services synchronously in the middle of handling a
 * request, which is exactly the situation the Circuit Breaker pattern
 * exists for. The local Enrollment/EnrollmentStatus lookup below is a
 * normal JPA call (this service's own database) and needs no protection;
 * only the two cross-service HTTP calls do.
 */
@Service
public class EnrollmentDetailsService {

    private final EnrollmentService enrollmentService;
    private final EnrollmentStatusRepository enrollmentStatusRepository;
    private final StudentServiceClient studentServiceClient;
    private final CourseServiceClient courseServiceClient;

    public EnrollmentDetailsService(EnrollmentService enrollmentService,
                                     EnrollmentStatusRepository enrollmentStatusRepository,
                                     StudentServiceClient studentServiceClient,
                                     CourseServiceClient courseServiceClient) {
        this.enrollmentService = enrollmentService;
        this.enrollmentStatusRepository = enrollmentStatusRepository;
        this.studentServiceClient = studentServiceClient;
        this.courseServiceClient = courseServiceClient;
    }

    public EnrollmentDetails getDetails(Long enrollmentId) {
        Enrollment enrollment = enrollmentService.findById(enrollmentId);
        String statusName = enrollmentStatusRepository.findById(enrollment.getStatusId())
                .map(EnrollmentStatus::getStatusName)
                .orElse("UNKNOWN");

        StudentSummary student = studentServiceClient.getStudent(enrollment.getStudentId());
        CourseSummary course = courseServiceClient.getCourse(enrollment.getCourseId());

        return new EnrollmentDetails(enrollmentId, statusName, student, course);
    }
}
