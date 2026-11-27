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

    public List<Course> findAll(Long categoryId) {
        if (categoryId != null) {
            return courseRepository.findByCategoryId(categoryId);
        }
        return courseRepository.findAll();
    }

    public Course findById(Long id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found: " + id));
    }

    public boolean existsById(Long id) {
        return courseRepository.existsById(id);
    }

    public Course create(Course course) {
        return courseRepository.save(course);
    }

    public Course update(Long id, Course course) {
        Course existing = findById(id);
        existing.setCategoryId(course.getCategoryId());
        existing.setCourseCode(course.getCourseCode());
        existing.setCourseName(course.getCourseName());
        existing.setDescription(course.getDescription());
        existing.setDurationWeeks(course.getDurationWeeks());
        existing.setCredits(course.getCredits());
        existing.setFee(course.getFee());
        return courseRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        courseRepository.deleteById(id);
    }
}
