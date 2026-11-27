package com.studentmgmt.course.repository;

import com.studentmgmt.course.entity.CourseFaculty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CourseFacultyRepository extends JpaRepository<CourseFaculty, Long> {

    List<CourseFaculty> findByCourseId(Long courseId);
}
