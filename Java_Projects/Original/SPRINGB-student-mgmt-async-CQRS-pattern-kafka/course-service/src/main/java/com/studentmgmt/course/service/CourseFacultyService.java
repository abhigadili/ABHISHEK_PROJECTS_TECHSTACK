package com.studentmgmt.course.service;

import com.studentmgmt.course.entity.CourseFaculty;
import com.studentmgmt.course.exception.ResourceNotFoundException;
import com.studentmgmt.course.repository.CourseFacultyRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseFacultyService {

    private final CourseFacultyRepository courseFacultyRepository;

    public CourseFacultyService(CourseFacultyRepository courseFacultyRepository) {
        this.courseFacultyRepository = courseFacultyRepository;
    }

    public List<CourseFaculty> findAll(Long courseId) {
        if (courseId != null) {
            return courseFacultyRepository.findByCourseId(courseId);
        }
        return courseFacultyRepository.findAll();
    }

    public CourseFaculty findById(Long id) {
        return courseFacultyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course faculty not found: " + id));
    }

    public CourseFaculty create(CourseFaculty faculty) {
        return courseFacultyRepository.save(faculty);
    }

    public void delete(Long id) {
        findById(id);
        courseFacultyRepository.deleteById(id);
    }
}
