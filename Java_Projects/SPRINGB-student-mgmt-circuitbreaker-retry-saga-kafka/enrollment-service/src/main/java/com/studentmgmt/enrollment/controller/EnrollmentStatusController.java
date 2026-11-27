package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.repository.EnrollmentStatusRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/enrollment-statuses")
public class EnrollmentStatusController {

    private final EnrollmentStatusRepository enrollmentStatusRepository;

    public EnrollmentStatusController(EnrollmentStatusRepository enrollmentStatusRepository) {
        this.enrollmentStatusRepository = enrollmentStatusRepository;
    }

    @GetMapping
    public List<EnrollmentStatus> findAll() {
        return enrollmentStatusRepository.findAll();
    }
}
