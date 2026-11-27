package com.studentmgmt.course.service;

import com.studentmgmt.course.dao.CourseScheduleDao;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.model.CourseSchedule;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseScheduleServiceImpl implements CourseScheduleService {

    private final CourseScheduleDao courseScheduleDao;

    public CourseScheduleServiceImpl(CourseScheduleDao courseScheduleDao) {
        this.courseScheduleDao = courseScheduleDao;
    }

    @Override
    public List<CourseSchedule> findAll() {
        return courseScheduleDao.findAll();
    }

    @Override
    public List<CourseSchedule> findByCourseId(Long courseId) {
        return courseScheduleDao.findByCourseId(courseId);
    }

    @Override
    public CourseSchedule findById(Long scheduleId) {
        return courseScheduleDao.findById(scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Course schedule not found: " + scheduleId));
    }

    @Override
    public CourseSchedule create(CourseSchedule schedule) {
        return courseScheduleDao.save(schedule);
    }

    @Override
    public void delete(Long scheduleId) {
        findById(scheduleId);
        courseScheduleDao.deleteById(scheduleId);
    }
}
