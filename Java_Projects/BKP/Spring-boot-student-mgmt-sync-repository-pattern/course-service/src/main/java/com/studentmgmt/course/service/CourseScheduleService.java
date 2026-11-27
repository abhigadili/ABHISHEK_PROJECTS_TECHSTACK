package com.studentmgmt.course.service;

import com.studentmgmt.course.entity.CourseSchedule;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.repository.CourseScheduleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseScheduleService {

    private final CourseScheduleRepository courseScheduleRepository;

    public CourseScheduleService(CourseScheduleRepository courseScheduleRepository) {
        this.courseScheduleRepository = courseScheduleRepository;
    }

    public List<CourseSchedule> findAll(Long courseId) {
        if (courseId != null) {
            return courseScheduleRepository.findByCourseId(courseId);
        }
        return courseScheduleRepository.findAll();
    }

    public CourseSchedule findById(Long id) {
        return courseScheduleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course schedule not found: " + id));
    }

    public CourseSchedule create(CourseSchedule schedule) {
        return courseScheduleRepository.save(schedule);
    }

    public CourseSchedule update(Long id, CourseSchedule schedule) {
        CourseSchedule existing = findById(id);
        existing.setCourseId(schedule.getCourseId());
        existing.setStartDate(schedule.getStartDate());
        existing.setEndDate(schedule.getEndDate());
        existing.setClassDays(schedule.getClassDays());
        existing.setStartTime(schedule.getStartTime());
        existing.setEndTime(schedule.getEndTime());
        existing.setRoomNumber(schedule.getRoomNumber());
        return courseScheduleRepository.save(existing);
    }

    public void delete(Long id) {
        findById(id);
        courseScheduleRepository.deleteById(id);
    }
}
