package com.studentmgmt.course.service;

import com.studentmgmt.course.entity.CourseCategory;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.repository.CourseCategoryRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseCategoryService {

    private final CourseCategoryRepository courseCategoryRepository;

    public CourseCategoryService(CourseCategoryRepository courseCategoryRepository) {
        this.courseCategoryRepository = courseCategoryRepository;
    }

    public List<CourseCategory> findAll() {
        return courseCategoryRepository.findAll();
    }

    public CourseCategory findById(Long id) {
        return courseCategoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course category not found: " + id));
    }

    public CourseCategory create(CourseCategory category) {
        return courseCategoryRepository.save(category);
    }

    public CourseCategory update(Long id, CourseCategory category) {
        CourseCategory existing = findById(id);
        existing.setCategoryName(category.getCategoryName());
        existing.setDescription(category.getDescription());
        return courseCategoryRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        courseCategoryRepository.deleteById(id);
    }
}
