package com.studentmgmt.course.command.controller;

import com.studentmgmt.course.command.entity.Course;
import com.studentmgmt.course.command.service.CourseCommandService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Write-only: POST/PUT/DELETE. Reads go through CourseQueryController. */
@RestController
@RequestMapping("/api/courses")
public class CourseCommandController {

    private final CourseCommandService courseCommandService;

    public CourseCommandController(CourseCommandService courseCommandService) {
        this.courseCommandService = courseCommandService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Course create(@Valid @RequestBody Course course) {
        return courseCommandService.create(course);
    }

    @PutMapping("/{id}")
    public Course update(@PathVariable Long id, @Valid @RequestBody Course course) {
        return courseCommandService.update(id, course);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseCommandService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
