package com.studentmgmt.course.command.service;

import com.studentmgmt.course.command.entity.Course;
import com.studentmgmt.course.command.repository.CourseCommandRepository;
import com.studentmgmt.course.entity.CourseCategory;
import com.studentmgmt.course.event.CourseChangedEvent;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.kafka.CourseChangedProducer;
import com.studentmgmt.course.repository.CourseCategoryRepository;
import org.springframework.stereotype.Service;

@Service
public class CourseCommandService {

    private final CourseCommandRepository courseCommandRepository;
    private final CourseCategoryRepository courseCategoryRepository;
    private final CourseChangedProducer courseChangedProducer;

    public CourseCommandService(CourseCommandRepository courseCommandRepository,
                                 CourseCategoryRepository courseCategoryRepository,
                                 CourseChangedProducer courseChangedProducer) {
        this.courseCommandRepository = courseCommandRepository;
        this.courseCategoryRepository = courseCategoryRepository;
        this.courseChangedProducer = courseChangedProducer;
    }

    public Course create(Course course) {
        Course saved = courseCommandRepository.save(course);
        courseChangedProducer.publish(toEvent(CourseChangedEvent.CREATED, saved));
        return saved;
    }

    public Course update(Long id, Course course) {
        Course existing = courseCommandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found: " + id));
        existing.setCategoryId(course.getCategoryId());
        existing.setCourseCode(course.getCourseCode());
        existing.setCourseName(course.getCourseName());
        existing.setDescription(course.getDescription());
        existing.setDurationWeeks(course.getDurationWeeks());
        existing.setCredits(course.getCredits());
        existing.setFee(course.getFee());
        Course saved = courseCommandRepository.save(existing);
        courseChangedProducer.publish(toEvent(CourseChangedEvent.UPDATED, saved));
        return saved;
    }

    public void delete(Long id) {
        Course existing = courseCommandRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found: " + id));
        courseCommandRepository.deleteById(id);
        courseChangedProducer.publish(toEvent(CourseChangedEvent.DELETED, existing));
    }

    /** Looks up the category name ONCE here, so the read side never has to join Course_Category. */
    private CourseChangedEvent toEvent(String operation, Course course) {
        String categoryName = courseCategoryRepository.findById(course.getCategoryId())
                .map(CourseCategory::getCategoryName)
                .orElse("Unknown");

        CourseChangedEvent event = new CourseChangedEvent();
        event.setOperation(operation);
        event.setCourseId(course.getCourseId());
        event.setCategoryId(course.getCategoryId());
        event.setCategoryName(categoryName);
        event.setCourseCode(course.getCourseCode());
        event.setCourseName(course.getCourseName());
        event.setDescription(course.getDescription());
        event.setDurationWeeks(course.getDurationWeeks());
        event.setCredits(course.getCredits());
        event.setFee(course.getFee());
        return event;
    }
}
