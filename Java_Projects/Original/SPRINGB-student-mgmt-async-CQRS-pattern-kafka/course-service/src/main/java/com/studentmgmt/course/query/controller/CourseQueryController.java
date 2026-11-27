package com.studentmgmt.course.query.controller;

import com.studentmgmt.course.query.entity.CourseView;
import com.studentmgmt.course.query.service.CourseQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only: every GET here comes from Courses_View, already carrying categoryName — no join. */
@RestController
@RequestMapping("/api/courses")
public class CourseQueryController {

    private final CourseQueryService courseQueryService;

    public CourseQueryController(CourseQueryService courseQueryService) {
        this.courseQueryService = courseQueryService;
    }

    @GetMapping
    public List<CourseView> findAll(@RequestParam(required = false) Long categoryId) {
        return courseQueryService.findAll(categoryId);
    }

    @GetMapping("/{id}")
    public CourseView findById(@PathVariable Long id) {
        return courseQueryService.findById(id);
    }
}
