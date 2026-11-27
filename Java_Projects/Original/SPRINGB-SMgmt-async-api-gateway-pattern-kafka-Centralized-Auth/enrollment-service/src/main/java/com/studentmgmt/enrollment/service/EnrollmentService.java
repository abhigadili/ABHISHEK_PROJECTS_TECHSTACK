package com.studentmgmt.enrollment.service;

import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.entity.EnrollmentValidation;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.kafka.EnrollmentRequestedProducer;
import com.studentmgmt.enrollment.repository.EnrollmentRepository;
import com.studentmgmt.enrollment.repository.EnrollmentValidationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentValidationRepository enrollmentValidationRepository;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentRequestedProducer enrollmentRequestedProducer;

    public EnrollmentService(EnrollmentRepository enrollmentRepository,
                              EnrollmentValidationRepository enrollmentValidationRepository,
                              EnrollmentStatusService enrollmentStatusService,
                              EnrollmentRequestedProducer enrollmentRequestedProducer) {
        this.enrollmentRepository = enrollmentRepository;
        this.enrollmentValidationRepository = enrollmentValidationRepository;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentRequestedProducer = enrollmentRequestedProducer;
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
     * Inserts the Enrollment row as PENDING_VALIDATION and publishes
     * `enrollment.requested` — does NOT wait for student-service/course-service
     * to reply. The returned Enrollment is only "provisionally" created; poll
     * findById(id) to observe it move to CONFIRMED or REJECTED.
     */
    @Transactional
    public Enrollment create(Enrollment enrollment) {
        enrollment.setStatusId(enrollmentStatusService.findByStatusName("PENDING_VALIDATION").getStatusId());
        if (enrollment.getEnrollmentDate() == null) {
            enrollment.setEnrollmentDate(LocalDate.now());
        }

        Enrollment created = enrollmentRepository.save(enrollment);
        enrollmentValidationRepository.save(new EnrollmentValidation(created.getEnrollmentId()));

        enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(
                created.getEnrollmentId(), created.getStudentId(), created.getCourseId(),
                LocalDateTime.now().toString()));

        return created;
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
}
