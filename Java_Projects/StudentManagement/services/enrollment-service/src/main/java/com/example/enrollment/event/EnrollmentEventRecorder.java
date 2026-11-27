package com.example.enrollment.event;

import com.example.enrollment.entity.Enrollment;
import com.example.enrollment.outbox.OutboxWriter;
import com.example.events.EnrollmentEvent;
import com.example.events.EnrollmentEventType;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Builds integration events from an Enrollment and stores them in the outbox. MANDATORY propagation: it can only be
 * called inside the transaction that changes the enrollment, which is what makes the outbox pattern atomic.
 */
@Component
public class EnrollmentEventRecorder {
    private final OutboxWriter outbox;

    public EnrollmentEventRecorder(OutboxWriter outbox) { this.outbox = outbox; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(EnrollmentEventType type, Enrollment e, String reason, String correlationId) {
        String cid = correlationId != null ? correlationId : MDC.get("correlationId");
        EnrollmentEvent event = new EnrollmentEvent(UUID.randomUUID().toString(), type, e.getEnrollmentId(), e.getStudentId(),
                e.getCourseId(), e.getStudentName(), e.getStudentEmail(), e.getCourseName(), reason, cid, Instant.now());
        outbox.store(type.topic(), String.valueOf(e.getEnrollmentId()), event);
    }
}
