package com.example.student.controller;

import com.example.common.exception.ApiError;
import com.example.common.security.AuthenticatedUser;
import com.example.student.dto.*;
import com.example.student.entity.Gender;
import com.example.student.entity.StudentStatus;
import com.example.student.service.StudentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/students")
@Tag(name = "Students", description = "Student registration, profile management, search and eligibility")
public class StudentController {
    private final StudentService service;

    public StudentController(StudentService service) { this.service = service; }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Register a student",
            requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
                    value = "{\"firstName\":\"Asha\",\"lastName\":\"Rao\",\"email\":\"asha.rao@example.com\",\"phoneNumber\":\"+91 9876543210\",\"dateOfBirth\":\"2002-05-14\",\"gender\":\"FEMALE\",\"address\":\"Hyderabad\"}"))))
    @ApiResponses({@ApiResponse(responseCode = "201", description = "Created"),
            @ApiResponse(responseCode = "400", description = "Validation failed", content = @Content(schema = @Schema(implementation = ApiError.class))),
            @ApiResponse(responseCode = "409", description = "Email already exists"),
            @ApiResponse(responseCode = "401", description = "Missing/invalid token"), @ApiResponse(responseCode = "403", description = "Role not allowed")})
    public ResponseEntity<StudentResponse> create(@Valid @RequestBody StudentRequest request) {
        StudentResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/students/" + created.studentId())).body(created);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Search/filter students (paged, sortable)",
            description = "search matches first name, last name or email. sort e.g. lastName,asc")
    public Page<StudentResponse> search(@RequestParam(required = false) String search,
                                        @RequestParam(required = false) StudentStatus status,
                                        @RequestParam(required = false) Gender gender,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size,
                                        @RequestParam(defaultValue = "studentId,asc") String sort) {
        return service.search(search, status, gender, pageable(page, size, sort));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','SERVICE') or (hasRole('STUDENT') and #user.studentId == #id)")
    @Operation(summary = "Get a student (STUDENT may only read their own profile)")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Found"), @ApiResponse(responseCode = "404", description = "Not found")})
    public StudentResponse get(@PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
        return service.getById(id);
    }

    @GetMapping("/{id}/eligibility")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','SERVICE')")
    @Operation(summary = "Is the student eligible to enroll (status ACTIVE)?")
    public EligibilityResponse eligibility(@PathVariable Long id) { return service.eligibility(id); }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF') or (hasRole('STUDENT') and #user.studentId == #id)")
    @Operation(summary = "Update a student profile")
    public StudentResponse update(@PathVariable Long id, @Valid @RequestBody StudentRequest request,
                                  @AuthenticationPrincipal AuthenticatedUser user) {
        if (!user.isStaffOrAdmin() && request.status() != null) {
            throw new AccessDeniedException("Students cannot change their status");
        }
        return service.update(id, request);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Activate / deactivate a student")
    public StudentResponse updateStatus(@PathVariable Long id, @Valid @RequestBody StatusUpdateRequest request) {
        return service.updateStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete a student (ADMIN only)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private static final java.util.Set<String> SORTABLE = java.util.Set.of("studentId", "firstName", "lastName", "email",
            "status", "gender", "enrollmentDate", "createdAt");

    static Pageable pageable(int page, int size, String sort) {
        String[] p = sort.split(",");
        if (!SORTABLE.contains(p[0])) throw new IllegalArgumentException("Cannot sort by '" + p[0] + "'. Allowed: " + SORTABLE);
        Sort.Direction dir = p.length > 1 ? Sort.Direction.fromString(p[1]) : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(dir, p[0]));
    }
}
