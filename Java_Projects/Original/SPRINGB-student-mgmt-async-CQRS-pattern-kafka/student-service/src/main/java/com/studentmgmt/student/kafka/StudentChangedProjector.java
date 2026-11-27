package com.studentmgmt.student.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.student.event.StudentChangedEvent;
import com.studentmgmt.student.query.entity.StudentView;
import com.studentmgmt.student.query.repository.StudentQueryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * The projector: the only writer of Students_View. Consumes `student.changed`
 * and upserts (CREATED/UPDATED) or removes (DELETED) the matching row. This
 * is what makes the read model "eventually consistent" rather than
 * immediately consistent — there's a small window, normally well under a
 * second, between a command committing and this listener catching up.
 */
@Component
public class StudentChangedProjector {

    private static final Logger log = LoggerFactory.getLogger(StudentChangedProjector.class);

    private final StudentQueryRepository studentQueryRepository;
    private final ObjectMapper objectMapper;

    public StudentChangedProjector(StudentQueryRepository studentQueryRepository, ObjectMapper objectMapper) {
        this.studentQueryRepository = studentQueryRepository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.student-changed}")
    public void onStudentChanged(String message) {
        try {
            StudentChangedEvent event = objectMapper.readValue(message, StudentChangedEvent.class);
            log.info("Received student.changed: {}", message);

            if (StudentChangedEvent.DELETED.equals(event.getOperation())) {
                studentQueryRepository.deleteById(event.getStudentId());
                return;
            }

            StudentView view = studentQueryRepository.findById(event.getStudentId()).orElseGet(StudentView::new);
            view.setStudentId(event.getStudentId());
            view.setFirstName(event.getFirstName());
            view.setLastName(event.getLastName());
            view.setFullName(event.getFirstName() + " " + event.getLastName());
            view.setEmail(event.getEmail());
            view.setPhone(event.getPhone());
            view.setDateOfBirth(event.getDateOfBirth() != null ? LocalDate.parse(event.getDateOfBirth()) : null);
            view.setGender(event.getGender());
            view.setEnrollmentDate(event.getEnrollmentDate() != null ? LocalDate.parse(event.getEnrollmentDate()) : null);
            studentQueryRepository.save(view);
        } catch (Exception e) {
            log.error("Failed to project student.changed message: {}", message, e);
        }
    }
}
