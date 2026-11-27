package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.Course;

import java.util.List;
import java.util.Optional;

public interface CourseDao {

    List<Course> findAll();

    Optional<Course> findById(Long courseId);

    boolean existsById(Long courseId);

    Course save(Course course);

    Course update(Long courseId, Course course);

    void deleteById(Long courseId);
}
