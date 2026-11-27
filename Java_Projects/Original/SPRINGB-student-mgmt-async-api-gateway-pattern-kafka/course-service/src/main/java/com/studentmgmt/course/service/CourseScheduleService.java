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

    public void delete(Long id) {
        findById(id);
        courseScheduleRepository.deleteById(id);
    }
}
