package com.studentmgmt.course.service;

import com.studentmgmt.course.dao.CourseCategoryDao;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.model.CourseCategory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseCategoryServiceImpl implements CourseCategoryService {

    private final CourseCategoryDao courseCategoryDao;

    public CourseCategoryServiceImpl(CourseCategoryDao courseCategoryDao) {
        this.courseCategoryDao = courseCategoryDao;
    }

    @Override
    public List<CourseCategory> findAll() {
        return courseCategoryDao.findAll();
    }

    @Override
    public CourseCategory findById(Long categoryId) {
        return courseCategoryDao.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Course category not found: " + categoryId));
    }

    @Override
    public CourseCategory create(CourseCategory category) {
        return courseCategoryDao.save(category);
    }

    @Override
    public CourseCategory update(Long categoryId, CourseCategory category) {
        findById(categoryId);
        return courseCategoryDao.update(categoryId, category);
    }

    @Override
    public void delete(Long categoryId) {
        findById(categoryId);
        courseCategoryDao.deleteById(categoryId);
    }
}
