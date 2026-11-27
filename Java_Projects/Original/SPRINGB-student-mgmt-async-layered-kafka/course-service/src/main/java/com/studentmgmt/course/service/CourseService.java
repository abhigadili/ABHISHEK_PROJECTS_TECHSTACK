package com.studentmgmt.course.service;

import com.studentmgmt.course.model.Course;

import java.util.List;

public interface CourseService {

    List<Course> findAll();

    Course findById(Long id);

    boolean existsById(Long id);

    Course create(Course course);

    Course update(Long id, Course course);

    void delete(Long id);
}
