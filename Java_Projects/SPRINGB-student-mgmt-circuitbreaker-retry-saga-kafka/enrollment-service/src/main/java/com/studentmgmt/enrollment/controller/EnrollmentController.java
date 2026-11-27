package com.studentmgmt.enrollment.controller;

import com.studentmgmt.enrollment.dto.EnrollmentDetails;
import com.studentmgmt.enrollment.entity.Enrollment;
import com.studentmgmt.enrollment.service.EnrollmentDetailsService;
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
    private final EnrollmentDetailsService enrollmentDetailsService;

    public EnrollmentController(EnrollmentService enrollmentService, EnrollmentDetailsService enrollmentDetailsService) {
        this.enrollmentService = enrollmentService;
        this.enrollmentDetailsService = enrollmentDetailsService;
    }

    @GetMapping
    public List<Enrollment> findAll() {
        return enrollmentService.findAll();
    }

    @GetMapping("/{id}")
    public Enrollment findById(@PathVariable Long id) {
        return enrollmentService.findById(id);
    }

    /** CIRCUIT BREAKER PATTERN demo endpoint — see EnrollmentDetailsService. */
    @GetMapping("/{id}/details")
    public EnrollmentDetails getDetails(@PathVariable Long id) {
        return enrollmentDetailsService.getDetails(id);
    }

    /**
     * SAGA PATTERN entry point. Always returns 202 Accepted, never 200/201:
     * this only confirms the request was ACCEPTED for asynchronous
     * processing — student/course validation happens afterwards, over
     * Kafka, and the final CONFIRMED/REJECTED status is only visible on a
     * later GET.
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
