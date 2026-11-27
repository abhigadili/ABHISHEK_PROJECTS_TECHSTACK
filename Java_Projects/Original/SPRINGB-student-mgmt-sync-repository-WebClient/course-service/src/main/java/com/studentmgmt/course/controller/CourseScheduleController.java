package com.studentmgmt.course.controller;

import com.studentmgmt.course.entity.CourseSchedule;
import com.studentmgmt.course.service.CourseScheduleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/course-schedules")
public class CourseScheduleController {

    private final CourseScheduleService courseScheduleService;

    public CourseScheduleController(CourseScheduleService courseScheduleService) {
        this.courseScheduleService = courseScheduleService;
    }

    @GetMapping
    public List<CourseSchedule> findAll(@RequestParam(required = false) Long courseId) {
        return courseScheduleService.findAll(courseId);
    }

    @GetMapping("/{id}")
    public CourseSchedule findById(@PathVariable Long id) {
        return courseScheduleService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseSchedule create(@Valid @RequestBody CourseSchedule schedule) {
        return courseScheduleService.create(schedule);
    }

    @PutMapping("/{id}")
    public CourseSchedule update(@PathVariable Long id, @Valid @RequestBody CourseSchedule schedule) {
        return courseScheduleService.update(id, schedule);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courseScheduleService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
