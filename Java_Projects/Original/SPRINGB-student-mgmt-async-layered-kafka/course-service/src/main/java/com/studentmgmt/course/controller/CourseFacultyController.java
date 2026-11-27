package com.studentmgmt.course.controller;

import com.studentmgmt.course.model.CourseFaculty;
import com.studentmgmt.course.service.CourseFacultyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/course-faculty")
public class CourseFacultyController {

    private final CourseFacultyService courseFacultyService;

    public CourseFacultyController(CourseFacultyService courseFacultyService) {
        this.courseFacultyService = courseFacultyService;
    }

    @GetMapping
    public List<CourseFaculty> findAll(@RequestParam(required = false) Long courseId) {
        return courseId != null ? courseFacultyService.findByCourseId(courseId) : courseFacultyService.findAll();
    }

    @GetMapping("/{id}")
    public CourseFaculty findById(@PathVariable Long id) {
        return courseFacultyService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseFaculty create(@Valid @RequestBody CourseFaculty faculty) {
        return courseFacultyService.create(faculty);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseFacultyService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
