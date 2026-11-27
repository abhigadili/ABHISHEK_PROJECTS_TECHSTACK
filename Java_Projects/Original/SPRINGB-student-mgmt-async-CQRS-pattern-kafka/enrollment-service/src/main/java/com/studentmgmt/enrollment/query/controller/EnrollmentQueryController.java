package com.studentmgmt.enrollment.query.controller;

import com.studentmgmt.enrollment.query.entity.EnrollmentView;
import com.studentmgmt.enrollment.query.service.EnrollmentQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only: every GET here comes from Enrollments_View, already carrying statusName — no join. */
@RestController
@RequestMapping("/api/enrollments")
public class EnrollmentQueryController {

    private final EnrollmentQueryService enrollmentQueryService;

    public EnrollmentQueryController(EnrollmentQueryService enrollmentQueryService) {
        this.enrollmentQueryService = enrollmentQueryService;
    }

    @GetMapping
    public List<EnrollmentView> findAll(@RequestParam(required = false) Long studentId,
                                         @RequestParam(required = false) Long courseId) {
        return enrollmentQueryService.findAll(studentId, courseId);
    }

    @GetMapping("/{id}")
    public EnrollmentView findById(@PathVariable Long id) {
        return enrollmentQueryService.findById(id);
    }
}
