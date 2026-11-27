package com.studentmgmt.course.controller;

import com.studentmgmt.course.entity.Course;
import com.studentmgmt.course.service.CourseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping
    public List<Course> findAll(@RequestParam(required = false) Long categoryId) {
        return courseService.findAll(categoryId);
    }

    @GetMapping("/{id}")
    public Course findById(@PathVariable Long id) {
        return courseService.findById(id);
    }

    /** Kept for manual inspection/debugging — the enrollment saga itself checks existence via Kafka, not this endpoint. */
    @GetMapping("/{id}/exists")
    public Map<String, Boolean> exists(@PathVariable Long id) {
        return Map.of("exists", courseService.existsById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Course create(@Valid @RequestBody Course course) {
        return courseService.create(course);
    }

    @PutMapping("/{id}")
    public Course update(@PathVariable Long id, @Valid @RequestBody Course course) {
        return courseService.update(id, course);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
