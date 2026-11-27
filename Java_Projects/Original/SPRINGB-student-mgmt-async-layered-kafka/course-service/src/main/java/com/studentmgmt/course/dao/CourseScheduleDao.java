package com.studentmgmt.course.dao;

import com.studentmgmt.course.model.CourseSchedule;

import java.util.List;
import java.util.Optional;

public interface CourseScheduleDao {

    List<CourseSchedule> findAll();

    List<CourseSchedule> findByCourseId(Long courseId);

    Optional<CourseSchedule> findById(Long scheduleId);

    CourseSchedule save(CourseSchedule schedule);

    void deleteById(Long scheduleId);
}
