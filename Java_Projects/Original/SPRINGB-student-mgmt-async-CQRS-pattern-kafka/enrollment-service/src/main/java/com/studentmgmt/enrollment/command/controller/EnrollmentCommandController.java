package com.studentmgmt.enrollment.command.controller;

import com.studentmgmt.enrollment.command.entity.Enrollment;
import com.studentmgmt.enrollment.command.service.EnrollmentCommandService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Write-only: POST/PUT/DELETE. Reads go through EnrollmentQueryController.
 * POST returns 202 Accepted, not 201 Created: the row exists as
 * PENDING_VALIDATION but the saga hasn't resolved it yet.
 */
@RestController
@RequestMapping("/api/enrollments")
public class EnrollmentCommandController {

    private final EnrollmentCommandService enrollmentCommandService;

    public EnrollmentCommandController(EnrollmentCommandService enrollmentCommandService) {
        this.enrollmentCommandService = enrollmentCommandService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Enrollment create(@Valid @RequestBody Enrollment enrollment) {
        return enrollmentCommandService.create(enrollment);
    }

    @PutMapping("/{id}")
    public Enrollment update(@PathVariable Long id, @Valid @RequestBody Enrollment enrollment) {
        return enrollmentCommandService.update(id, enrollment);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        enrollmentCommandService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
