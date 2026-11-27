package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.client.CourseClient;
import com.studentmgmt.enrollment.client.StudentClient;
import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.repository.EnrollmentRepository;
import com.studentmgmt.enrollment.repository.EnrollmentStatusRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentStatusRepository enrollmentStatusRepository;
    private final StudentClient studentClient;
    private final CourseClient courseClient;

    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                              EnrollmentStatusRepository enrollmentStatusRepository,
                              StudentClient studentClient,
                              CourseClient courseClient) {
        this.enrollmentRepository = enrollmentRepository;
        this.enrollmentStatusRepository = enrollmentStatusRepository;
        this.studentClient = studentClient;
        this.courseClient = courseClient;
    }

    public List<Enrollment> findAll(Long studentId, Long courseId) {
        if (studentId != null) {
            return enrollmentRepository.findByStudentId(studentId);
        }
        if (courseId != null) {
            return enrollmentRepository.findByCourseId(courseId);
        }
        return enrollmentRepository.findAll();
    }

    public Enrollment findById(Long id) {
        return enrollmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found: " + id));
    }

    /**
     * Creating an enrollment requires two synchronous checks against other
     * services before anything is written to EnrollmentDB: student-service
     * must confirm student_id exists, and course-service must confirm
     * course_id exists. Both calls block until they answer — if either
     * service is down or the id is invalid, the enrollment is never created.
     */
    public Enrollment create(Enrollment enrollment) {
        if (!studentClient.exists(enrollment.getStudentId())) {
            throw new IllegalArgumentException("Student does not exist: " + enrollment.getStudentId());
        }
        if (!courseClient.exists(enrollment.getCourseId())) {
            throw new IllegalArgumentException("Course does not exist: " + enrollment.getCourseId());
        }

        if (enrollment.getStatusId() == null) {
            EnrollmentStatus pending = enrollmentStatusRepository.findByStatusName("Pending")
                    .orElseThrow(() -> new ResourceNotFoundException("Enrollment_Status 'Pending' seed row is missing"));
            enrollment.setStatusId(pending.getStatusId());
        }
        if (enrollment.getEnrollmentDate() == null) {
            enrollment.setEnrollmentDate(LocalDate.now());
        }
        return enrollmentRepository.save(enrollment);
    }

    public Enrollment update(Long id, Enrollment enrollment) {
        Enrollment existing = findById(id);
        existing.setStudentId(enrollment.getStudentId());
        existing.setCourseId(enrollment.getCourseId());
        existing.setStatusId(enrollment.getStatusId());
        existing.setEnrollmentDate(enrollment.getEnrollmentDate());
        existing.setCompletionDate(enrollment.getCompletionDate());
        return enrollmentRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        enrollmentRepository.deleteById(id);
    }

    /** Used by PaymentService to flip an enrollment to Active once payment succeeds. */
    void updateStatusByName(Long enrollmentId, String statusName) {
        Enrollment enrollment = findById(enrollmentId);
        EnrollmentStatus status = enrollmentStatusRepository.findByStatusName(statusName)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment_Status '" + statusName + "' seed row is missing"));
        enrollment.setStatusId(status.getStatusId());
        enrollmentRepository.save(enrollment);
    }
}
