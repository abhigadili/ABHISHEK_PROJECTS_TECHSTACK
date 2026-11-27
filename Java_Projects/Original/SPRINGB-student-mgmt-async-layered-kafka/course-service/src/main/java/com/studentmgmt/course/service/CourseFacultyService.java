package com.studentmgmt.course.service;

import com.studentmgmt.course.model.CourseFaculty;

import java.util.List;

public interface CourseFacultyService {

    List<CourseFaculty> findAll();

    List<CourseFaculty> findByCourseId(Long courseId);

    CourseFaculty findById(Long facultyId);

    CourseFaculty create(CourseFaculty faculty);

    void delete(Long facultyId);
}
