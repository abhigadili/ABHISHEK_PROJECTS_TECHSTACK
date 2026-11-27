package com.studentmgmt.course.service;

import com.studentmgmt.course.dao.CourseFacultyDao;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.model.CourseFaculty;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseFacultyServiceImpl implements CourseFacultyService {

    private final CourseFacultyDao courseFacultyDao;

    public CourseFacultyServiceImpl(CourseFacultyDao courseFacultyDao) {
        this.courseFacultyDao = courseFacultyDao;
    }

    @Override
    public List<CourseFaculty> findAll() {
        return courseFacultyDao.findAll();
    }

    @Override
    public List<CourseFaculty> findByCourseId(Long courseId) {
        return courseFacultyDao.findByCourseId(courseId);
    }

    @Override
    public CourseFaculty findById(Long facultyId) {
        return courseFacultyDao.findById(facultyId)
                .orElseThrow(() -> new ResourceNotFoundException("Course faculty not found: " + facultyId));
    }

    @Override
    public CourseFaculty create(CourseFaculty faculty) {
        return courseFacultyDao.save(faculty);
    }

    @Override
    public void delete(Long facultyId) {
        findById(facultyId);
        courseFacultyDao.deleteById(facultyId);
    }
}
