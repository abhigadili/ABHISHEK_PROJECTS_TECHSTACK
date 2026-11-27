package com.studentmgmt.course.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studentmgmt.course.event.CourseChangedEvent;
import com.studentmgmt.course.query.entity.CourseView;
import com.studentmgmt.course.query.repository.CourseQueryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class CourseChangedProjector {

    private static final Logger log = LoggerFactory.getLogger(CourseChangedProjector.class);

    private final CourseQueryRepository courseQueryRepository;
    private final ObjectMapper objectMapper;

    public CourseChangedProjector(CourseQueryRepository courseQueryRepository, ObjectMapper objectMapper) {
        this.courseQueryRepository = courseQueryRepository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "${app.kafka.topic.course-changed}")
    public void onCourseChanged(String message) {
        try {
            CourseChangedEvent event = objectMapper.readValue(message, CourseChangedEvent.class);
            log.info("Received course.changed: {}", message);

            if (CourseChangedEvent.DELETED.equals(event.getOperation())) {
                courseQueryRepository.deleteById(event.getCourseId());
                return;
            }

            CourseView view = courseQueryRepository.findById(event.getCourseId()).orElseGet(CourseView::new);
            view.setCourseId(event.getCourseId());
            view.setCategoryId(event.getCategoryId());
            view.setCategoryName(event.getCategoryName());
            view.setCourseCode(event.getCourseCode());
            view.setCourseName(event.getCourseName());
            view.setDescription(event.getDescription());
            view.setDurationWeeks(event.getDurationWeeks());
            view.setCredits(event.getCredits());
            view.setFee(event.getFee());
            courseQueryRepository.save(view);
        } catch (Exception e) {
            log.error("Failed to project course.changed message: {}", message, e);
        }
    }
}
