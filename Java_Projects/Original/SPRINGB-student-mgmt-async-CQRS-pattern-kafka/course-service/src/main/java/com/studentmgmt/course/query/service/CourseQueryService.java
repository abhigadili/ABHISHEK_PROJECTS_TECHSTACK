package com.studentmgmt.course.query.service;

import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.query.entity.CourseView;
import com.studentmgmt.course.query.repository.CourseQueryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseQueryService {

    private final CourseQueryRepository courseQueryRepository;

    public CourseQueryService(CourseQueryRepository courseQueryRepository) {
        this.courseQueryRepository = courseQueryRepository;
    }

    public List<CourseView> findAll(Long categoryId) {
        if (categoryId != null) {
            return courseQueryRepository.findByCategoryId(categoryId);
        }
        return courseQueryRepository.findAll();
    }

    public CourseView findById(Long id) {
        return courseQueryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found: " + id));
    }
}
