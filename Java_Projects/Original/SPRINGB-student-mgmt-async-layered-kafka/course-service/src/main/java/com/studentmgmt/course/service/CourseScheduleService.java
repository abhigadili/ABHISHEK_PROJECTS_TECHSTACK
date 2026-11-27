package com.studentmgmt.course.service;

import com.studentmgmt.course.model.CourseSchedule;

import java.util.List;

public interface CourseScheduleService {

    List<CourseSchedule> findAll();

    List<CourseSchedule> findByCourseId(Long courseId);

    CourseSchedule findById(Long scheduleId);

    CourseSchedule create(CourseSchedule schedule);

    void delete(Long scheduleId);
}
