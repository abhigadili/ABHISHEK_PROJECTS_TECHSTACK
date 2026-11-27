package com.studentmgmt.course.controller;

import com.studentmgmt.course.model.CourseCategory;
import com.studentmgmt.course.service.CourseCategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/course-categories")
public class CourseCategoryController {

    private final CourseCategoryService courseCategoryService;

    public CourseCategoryController(CourseCategoryService courseCategoryService) {
        this.courseCategoryService = courseCategoryService;
    }

    @GetMapping
    public List<CourseCategory> findAll() {
        return courseCategoryService.findAll();
    }

    @GetMapping("/{id}")
    public CourseCategory findById(@PathVariable Long id) {
        return courseCategoryService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseCategory create(@Valid @RequestBody CourseCategory category) {
        return courseCategoryService.create(category);
    }

    @PutMapping("/{id}")
    public CourseCategory update(@PathVariable Long id, @Valid @RequestBody CourseCategory category) {
        return courseCategoryService.update(id, category);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseCategoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
