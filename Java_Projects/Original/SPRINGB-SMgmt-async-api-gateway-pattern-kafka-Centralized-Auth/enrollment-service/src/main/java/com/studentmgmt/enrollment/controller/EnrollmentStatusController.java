package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.service.EnrollmentStatusService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/enrollment-statuses")
public class EnrollmentStatusController {

    private final EnrollmentStatusService enrollmentStatusService;

    public EnrollmentStatusController(EnrollmentStatusService enrollmentStatusService) {
        this.enrollmentStatusService = enrollmentStatusService;
    }

    @GetMapping
    public List<EnrollmentStatus> findAll() {
        return enrollmentStatusService.findAll();
    }

    @GetMapping("/{id}")
    public EnrollmentStatus findById(@PathVariable Long id) {
        return enrollmentStatusService.findById(id);
    }
}
