package com.studentmgmt.course.service;

import com.studentmgmt.course.entity.Course;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.repository.CourseRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseService {

    private final CourseRepository courseRepository;

    public CourseService(CourseRepository courseRepository) {
        this.courseRepository = courseRepository;
    }

    public List<Course> findAll() {
        return courseRepository.findAll();
    }

    public Course findById(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + id));
    }

    public boolean existsById(Long id) {
        return courseRepository.existsById(id);
    }

    public Course create(Course course) {
        course.setCourseId(null);
        return courseRepository.save(course);
    }

    public Course update(Long id, Course update) {
        Course existing = findById(id);
        existing.setCourseName(update.getCourseName());
        existing.setDescription(update.getDescription());
        existing.setCredits(update.getCredits());
        existing.setDurationWeeks(update.getDurationWeeks());
        existing.setFee(update.getFee());
        existing.setActive(update.getActive());
        return courseRepository.save(existing);
    }

    public void delete(Long id) {
        if (!courseRepository.existsById(id)) {
            throw new ResourceNotFoundException("Course not found with id: " + id);
        }
        courseRepository.deleteById(id);
    }
}
