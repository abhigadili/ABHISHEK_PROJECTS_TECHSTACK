package com.studentmgmt.course.service;

import com.studentmgmt.course.model.CourseCategory;

import java.util.List;

public interface CourseCategoryService {

    List<CourseCategory> findAll();

    CourseCategory findById(Long categoryId);

    CourseCategory create(CourseCategory category);

    CourseCategory update(Long categoryId, CourseCategory category);

    void delete(Long categoryId);
}
