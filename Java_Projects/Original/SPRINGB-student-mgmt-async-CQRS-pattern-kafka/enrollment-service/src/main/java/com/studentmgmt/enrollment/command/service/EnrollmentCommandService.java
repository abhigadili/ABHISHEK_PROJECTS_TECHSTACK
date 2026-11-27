package com.studentmgmt.enrollment.command.service;

import com.studentmgmt.enrollment.command.entity.Enrollment;
import com.studentmgmt.enrollment.command.entity.EnrollmentValidation;
import com.studentmgmt.enrollment.command.repository.EnrollmentCommandRepository;
import com.studentmgmt.enrollment.command.repository.EnrollmentValidationRepository;
import com.studentmgmt.enrollment.event.EnrollmentChangedEvent;
import com.studentmgmt.enrollment.event.EnrollmentRequestedEvent;
import com.studentmgmt.enrollment.exception.ResourceNotFoundException;
import com.studentmgmt.enrollment.kafka.EnrollmentChangedProducer;
import com.studentmgmt.enrollment.kafka.EnrollmentRequestedProducer;
import com.studentmgmt.enrollment.service.EnrollmentStatusService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
public class EnrollmentCommandService {

    private final EnrollmentCommandRepository enrollmentCommandRepository;
    private final EnrollmentValidationRepository enrollmentValidationRepository;
    private final EnrollmentStatusService enrollmentStatusService;
    private final EnrollmentRequestedProducer enrollmentRequestedProducer;
    private final EnrollmentChangedProducer enrollmentChangedProducer;

    public EnrollmentCommandService(EnrollmentCommandRepository enrollmentCommandRepository,
                                     EnrollmentValidationRepository enrollmentValidationRepository,
                                     EnrollmentStatusService enrollmentStatusService,
                                     EnrollmentRequestedProducer enrollmentRequestedProducer,
                                     EnrollmentChangedProducer enrollmentChangedProducer) {
        this.enrollmentCommandRepository = enrollmentCommandRepository;
        this.enrollmentValidationRepository = enrollmentValidationRepository;
        this.enrollmentStatusService = enrollmentStatusService;
        this.enrollmentRequestedProducer = enrollmentRequestedProducer;
        this.enrollmentChangedProducer = enrollmentChangedProducer;
    }

    /**
     * Inserts the Enrollment row as PENDING_VALIDATION, publishes
     * `enrollment.requested` (the saga trigger) and `enrollment.changed` (so
     * the read model shows the pending row immediately) — does NOT wait for
     * student-service/course-service to reply. Poll GET /api/enrollments/{id}
     * to observe it move to CONFIRMED or REJECTED once EnrollmentSagaService
     * resolves it and fires a second enrollment.changed event.
     */
    @Transactional
    public Enrollment create(Enrollment enrollment) {
        Long pendingStatusId = enrollmentStatusService.findByStatusName("PENDING_VALIDATION").getStatusId();
        enrollment.setStatusId(pendingStatusId);
        if (enrollment.getEnrollmentDate() == null) {
            enrollment.setEnrollmentDate(LocalDate.now());
        }

        Enrollment created = enrollmentCommandRepository.save(enrollment);
        enrollmentValidationRepository.save(new EnrollmentValidation(created.getEnrollmentId()));

        enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(
                created.getEnrollmentId(), created.getStudentId(), created.getCourseId(),
                LocalDateTime.now().toString()));

        enrollmentChangedProducer.publish(toEvent(EnrollmentChangedEvent.CREATED, created, "PENDING_VALIDATION"));

        return created;
    }

    public Enrollment update(Long id, Enrollment enrollment) {
        Enrollment existing = enrollmentCommandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found: " + id));
        existing.setStudentId(enrollment.getStudentId());
        existing.setCourseId(enrollment.getCourseId());
        existing.setStatusId(enrollment.getStatusId());
        existing.setEnrollmentDate(enrollment.getEnrollmentDate());
        existing.setCompletionDate(enrollment.getCompletionDate());
        Enrollment saved = enrollmentCommandRepository.save(existing);

        String statusName = enrollmentStatusService.findById(saved.getStatusId()).getStatusName();
        enrollmentChangedProducer.publish(toEvent(EnrollmentChangedEvent.UPDATED, saved, statusName));
        return saved;
    }

    public void delete(Long id) {
        Enrollment existing = enrollmentCommandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found: " + id));
        enrollmentCommandRepository.deleteById(id);
        String statusName = enrollmentStatusService.findById(existing.getStatusId()).getStatusName();
        enrollmentChangedProducer.publish(toEvent(EnrollmentChangedEvent.DELETED, existing, statusName));
    }

    private EnrollmentChangedEvent toEvent(String operation, Enrollment enrollment, String statusName) {
        EnrollmentChangedEvent event = new EnrollmentChangedEvent();
        event.setOperation(operation);
        event.setEnrollmentId(enrollment.getEnrollmentId());
        event.setStudentId(enrollment.getStudentId());
        event.setCourseId(enrollment.getCourseId());
        event.setStatusId(enrollment.getStatusId());
        event.setStatusName(statusName);
        event.setEnrollmentDate(enrollment.getEnrollmentDate() != null ? enrollment.getEnrollmentDate().toString() : null);
        event.setCompletionDate(enrollment.getCompletionDate() != null ? enrollment.getCompletionDate().toString() : null);
        event.setRejectionReason(enrollment.getRejectionReason());
        return event;
    }
}
