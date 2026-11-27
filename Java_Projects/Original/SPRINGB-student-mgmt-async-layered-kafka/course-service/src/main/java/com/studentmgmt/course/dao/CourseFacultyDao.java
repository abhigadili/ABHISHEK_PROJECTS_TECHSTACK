package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.CourseFaculty;

import java.util.List;
import java.util.Optional;

public interface CourseFacultyDao {

    List<CourseFaculty> findAll();

    List<CourseFaculty> findByCourseId(Long courseId);

    Optional<CourseFaculty> findById(Long facultyId);

    CourseFaculty save(CourseFaculty faculty);

    void deleteById(Long facultyId);
}
