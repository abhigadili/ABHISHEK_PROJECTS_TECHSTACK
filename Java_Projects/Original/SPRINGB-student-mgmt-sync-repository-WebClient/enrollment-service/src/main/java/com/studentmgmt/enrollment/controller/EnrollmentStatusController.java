package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.entity.EnrollmentStatus;
import com.studentmgmt.enrollment.service.EnrollmentStatusService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EnrollmentStatus create(@Valid @RequestBody EnrollmentStatus status) {
        return enrollmentStatusService.create(status);
    }

    @PutMapping("/{id}")
    public EnrollmentStatus update(@PathVariable Long id, @Valid @RequestBody EnrollmentStatus status) {
        return enrollmentStatusService.update(id, status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        enrollmentStatusService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
