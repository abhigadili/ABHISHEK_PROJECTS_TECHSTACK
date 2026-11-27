package com.example.enrollment.controller;

import com.example.common.security.AuthenticatedUser;
import com.example.enrollment.command.*;
import com.example.enrollment.dto.*;
import com.example.enrollment.entity.EnrollmentStatus;
import com.example.enrollment.query.EnrollmentQueries.*;
import com.example.enrollment.query.EnrollmentQueryHandlers;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/enrollments")
@Tag(name = "Enrollments", description = "Enrollment commands (saga-driven) and queries (CQRS)")
public class EnrollmentController {
    private static final java.util.Set<String> SORTABLE = java.util.Set.of("enrollmentId", "studentId", "courseId", "status", "enrollmentDate", "createdAt");

    private final CreateEnrollmentCommandHandler createHandler;
    private final CancelEnrollmentCommandHandler cancelHandler;
    private final UpdateEnrollmentCommandHandler updateHandler;
    private final EnrollmentQueryHandlers queries;

    public EnrollmentController(CreateEnrollmentCommandHandler createHandler, CancelEnrollmentCommandHandler cancelHandler,
                                UpdateEnrollmentCommandHandler updateHandler, EnrollmentQueryHandlers queries) {
        this.createHandler = createHandler; this.cancelHandler = cancelHandler; this.updateHandler = updateHandler; this.queries = queries;
    }

    // ------------------------------------------------------------------ commands
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','STUDENT')")
    @Operation(summary = "Enroll a student in a course (runs the enrollment saga)",
            description = "Send an `Idempotency-Key` header to make retries safe: the same key always returns the same outcome. "
                    + "201 = CONFIRMED, 422 = REJECTED (reason in body), 202 = IN_PROGRESS (saga paused, resumed automatically), 409 = duplicate active enrollment. "
                    + "STUDENT users may only enroll themselves.",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(value = "{\"studentId\":1,\"courseId\":1}"))))
    @ApiResponses({@ApiResponse(responseCode = "201", description = "Confirmed"), @ApiResponse(responseCode = "202", description = "In progress"),
            @ApiResponse(responseCode = "409", description = "Duplicate enrollment"), @ApiResponse(responseCode = "422", description = "Rejected by the saga"),
            @ApiResponse(responseCode = "403", description = "Student enrolling someone else")})
    public ResponseEntity<EnrollmentOutcome> enroll(@Valid @RequestBody EnrollmentRequest request,
                                                    @Parameter(description = "Client-generated unique key; generated if absent") @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                                    @AuthenticationPrincipal AuthenticatedUser user) {
        requireSelfOrStaff(user, request.studentId());
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? UUID.randomUUID().toString() : idempotencyKey.trim();
        if (key.length() > 64) throw new IllegalArgumentException("Idempotency-Key must be at most 64 characters");
        EnrollmentOutcome outcome = createHandler.handle(new CreateEnrollmentCommand(request.studentId(), request.courseId(), key, MDC.get("correlationId")));
        HttpStatus status = switch (outcome.result()) {
            case EnrollmentOutcome.CONFIRMED -> HttpStatus.CREATED;
            case EnrollmentOutcome.REJECTED -> HttpStatus.UNPROCESSABLE_ENTITY;
            default -> HttpStatus.ACCEPTED;
        };
        return ResponseEntity.status(status).body(outcome);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','STUDENT')")
    @Operation(summary = "Cancel a CONFIRMED enrollment (releases the seat, publishes EnrollmentCancelled)")
    public EnrollmentResponse cancel(@PathVariable Long id, @RequestBody(required = false) @Valid CancelRequest body, @AuthenticationPrincipal AuthenticatedUser user) {
        requireSelfOrStaff(user, queries.handle(new GetEnrollmentQuery(id)).studentId());
        return cancelHandler.handle(new CancelEnrollmentCommand(id, body == null ? null : body.reason()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Update enrollment remarks (status is managed by the saga / cancel)")
    public EnrollmentResponse update(@PathVariable Long id, @Valid @RequestBody EnrollmentUpdateRequest body) {
        return updateHandler.handle(new UpdateEnrollmentCommand(id, body.remarks()));
    }

    // ------------------------------------------------------------------ queries
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','STUDENT')")
    @Operation(summary = "Get an enrollment (STUDENT: own only)")
    public EnrollmentResponse get(@PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
        EnrollmentResponse e = queries.handle(new GetEnrollmentQuery(id));
        requireSelfOrStaff(user, e.studentId());
        return e;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Search enrollments (filters + paging)")
    public Page<EnrollmentResponse> search(@RequestParam(required = false) Long studentId, @RequestParam(required = false) Long courseId,
                                           @RequestParam(required = false) EnrollmentStatus status,
                                           @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate to,
                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                           @RequestParam(defaultValue = "enrollmentId,desc") String sort) {
        return queries.handle(new SearchEnrollmentsQuery(studentId, courseId, status, from, to, pageable(page, size, sort)));
    }

    @GetMapping("/student/{studentId}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','STUDENT')")
    @Operation(summary = "Enrollment history of a student (STUDENT: own only)")
    public Page<EnrollmentResponse> history(@PathVariable Long studentId, @AuthenticationPrincipal AuthenticatedUser user,
                                            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                            @RequestParam(defaultValue = "enrollmentId,desc") String sort) {
        requireSelfOrStaff(user, studentId);
        return queries.handle(new StudentEnrollmentHistoryQuery(studentId, pageable(page, size, sort)));
    }

    @GetMapping("/course/{courseId}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Enrollments of a course")
    public Page<EnrollmentResponse> forCourse(@PathVariable Long courseId, @RequestParam(required = false) EnrollmentStatus status,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                              @RequestParam(defaultValue = "enrollmentId,desc") String sort) {
        return queries.handle(new CourseEnrollmentsQuery(courseId, status, pageable(page, size, sort)));
    }

    // ------------------------------------------------------------------ helpers
    private static void requireSelfOrStaff(AuthenticatedUser user, Long studentId) {
        if (user.isStaffOrAdmin()) return;
        if (user.studentId() == null || !user.studentId().equals(studentId)) throw new AccessDeniedException("Students may only access their own enrollments");
    }

    private static Pageable pageable(int page, int size, String sort) {
        String[] p = sort.split(",");
        if (!SORTABLE.contains(p[0])) throw new IllegalArgumentException("Cannot sort by '" + p[0] + "'. Allowed: " + SORTABLE);
        Sort.Direction dir = p.length > 1 ? Sort.Direction.fromString(p[1]) : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(dir, p[0]));
    }
}
