package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.service.EnrollmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/enrollments")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    public EnrollmentController(EnrollmentService enrollmentService) {
        this.enrollmentService = enrollmentService;
    }

    @GetMapping
    public List<Enrollment> findAll(@RequestParam(required = false) Long studentId,
                                     @RequestParam(required = false) Long courseId) {
        return enrollmentService.findAll(studentId, courseId);
    }

    @GetMapping("/{id}")
    public Enrollment findById(@PathVariable Long id) {
        return enrollmentService.findById(id);
    }

    /**
     * Returns 202 Accepted, not 201 Created: the row exists as PENDING_VALIDATION
     * but the saga hasn't resolved yet. Poll GET /api/enrollments/{id} — statusId
     * moves to CONFIRMED or REJECTED once student-service and course-service both
     * reply on Kafka.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Enrollment create(@Valid @RequestBody Enrollment enrollment) {
        return enrollmentService.create(enrollment);
    }

    @PutMapping("/{id}")
    public Enrollment update(@PathVariable Long id, @Valid @RequestBody Enrollment enrollment) {
        return enrollmentService.update(id, enrollment);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        enrollmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
