package com.studentmgmt.course.service;

import com.studentmgmt.course.dao.CourseDao;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.model.Course;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseServiceImpl implements CourseService {

    private final CourseDao courseDao;

    public CourseServiceImpl(CourseDao courseDao) {
        this.courseDao = courseDao;
    }

    @Override
    public List<Course> findAll() {
        return courseDao.findAll();
    }

    @Override
    public Course findById(Long id) {
        return courseDao.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found: " + id));
    }

    @Override
    public boolean existsById(Long id) {
        return courseDao.existsById(id);
    }

    @Override
    public Course create(Course course) {
        return courseDao.save(course);
    }

    @Override
    public Course update(Long id, Course course) {
        findById(id);
        return courseDao.update(id, course);
    }

    @Override
    public void delete(Long id) {
        findById(id);
        courseDao.deleteById(id);
    }
}
