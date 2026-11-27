package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.CourseCategory;

import java.util.List;
import java.util.Optional;

public interface CourseCategoryDao {

    List<CourseCategory> findAll();

    Optional<CourseCategory> findById(Long categoryId);

    CourseCategory save(CourseCategory category);

    CourseCategory update(Long categoryId, CourseCategory category);

    void deleteById(Long categoryId);
}
