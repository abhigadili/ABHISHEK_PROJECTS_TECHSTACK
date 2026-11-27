package com.studentmgmt.enrollment.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.enrollment.event.EnrollmentChangedEvent;
import com.studentmgmt.enrollment.query.entity.EnrollmentView;
import com.studentmgmt.enrollment.query.repository.EnrollmentQueryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * The projector: the only writer of Enrollments_View. Fires twice per
 * enrollment in the common case — once for the initial PENDING_VALIDATION
 * row, again once EnrollmentSagaService resolves it to CONFIRMED/REJECTED —
 * so a client polling GET /api/enrollments/{id} sees the status catch up to
 * the saga's outcome shortly after it resolves.
 */
@Component
public class EnrollmentChangedProjector {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentChangedProjector.class);

    private final EnrollmentQueryRepository enrollmentQueryRepository;
    private final ObjectMapper objectMapper;

    public EnrollmentChangedProjector(EnrollmentQueryRepository enrollmentQueryRepository, ObjectMapper objectMapper) {
        this.enrollmentQueryRepository = enrollmentQueryRepository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.enrollment-changed}")
    public void onEnrollmentChanged(String message) {
        try {
            EnrollmentChangedEvent event = objectMapper.readValue(message, EnrollmentChangedEvent.class);
            log.info("Received enrollment.changed: {}", message);

            if (EnrollmentChangedEvent.DELETED.equals(event.getOperation())) {
                enrollmentQueryRepository.deleteById(event.getEnrollmentId());
                return;
            }

            EnrollmentView view = enrollmentQueryRepository.findById(event.getEnrollmentId()).orElseGet(EnrollmentView::new);
            view.setEnrollmentId(event.getEnrollmentId());
            view.setStudentId(event.getStudentId());
            view.setCourseId(event.getCourseId());
            view.setStatusId(event.getStatusId());
            view.setStatusName(event.getStatusName());
            view.setEnrollmentDate(event.getEnrollmentDate() != null ? LocalDate.parse(event.getEnrollmentDate()) : null);
            view.setCompletionDate(event.getCompletionDate() != null ? LocalDate.parse(event.getCompletionDate()) : null);
            view.setRejectionReason(event.getRejectionReason());
            enrollmentQueryRepository.save(view);
        } catch (Exception e) {
            log.error("Failed to project enrollment.changed message: {}", message, e);
        }
    }
}
