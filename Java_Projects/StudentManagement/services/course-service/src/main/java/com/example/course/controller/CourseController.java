package com.example.course.controller;

import com.example.course.dto.*;
import com.example.course.dto.SeatDtos.*;
import com.example.course.entity.CourseStatus;
import com.example.course.service.CourseService;
import com.example.course.service.SeatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.net.URI;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/courses")
@Tag(name = "Courses", description = "Course catalogue, availability and seat reservation")
public class CourseController {
    private static final java.util.Set<String> SORTABLE = java.util.Set.of("courseId", "courseName", "courseCode", "fees",
            "durationWeeks", "totalSeats", "availableSeats", "status", "createdAt");
    private final CourseService courses;
    private final SeatService seats;

    public CourseController(CourseService courses, SeatService seats) { this.courses = courses; this.seats = seats; }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Create a course", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(
            examples = @ExampleObject(value = "{\"courseName\":\"Java Microservices\",\"courseCode\":\"JMS-101\",\"description\":\"Spring Boot + Kafka\",\"durationWeeks\":12,\"fees\":24999.00,\"totalSeats\":30}"))))
    @ApiResponses({@ApiResponse(responseCode = "201", description = "Created"), @ApiResponse(responseCode = "400", description = "Validation failed"),
            @ApiResponse(responseCode = "409", description = "Duplicate course code")})
    public ResponseEntity<CourseResponse> create(@Valid @RequestBody CourseRequest request) {
        CourseResponse c = courses.create(request);
        return ResponseEntity.created(URI.create("/api/courses/" + c.courseId())).body(c);
    }

    @GetMapping
    @Operation(summary = "Search/filter courses (paged, sortable)")
    public Page<CourseResponse> search(@RequestParam(required = false) String search, @RequestParam(required = false) Long categoryId,
                                       @RequestParam(required = false) CourseStatus status, @RequestParam(required = false) BigDecimal minFees,
                                       @RequestParam(required = false) BigDecimal maxFees, @RequestParam(defaultValue = "false") boolean availableOnly,
                                       @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                       @RequestParam(defaultValue = "courseId,asc") String sort) {
        return courses.search(search, categoryId, status, minFees, maxFees, availableOnly, pageable(page, size, sort));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a course (Redis-cached)")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Found"), @ApiResponse(responseCode = "404", description = "Not found")})
    public CourseResponse get(@PathVariable Long id) { return courses.getById(id); }

    @GetMapping("/{id}/availability")
    @Operation(summary = "Seat availability (Redis-cached, 1 min TTL, evicted on every seat change)")
    public CourseAvailabilityResponse availability(@PathVariable Long id) { return courses.availability(id); }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Update a course (changing totalSeats keeps already-reserved seats)")
    public CourseResponse update(@PathVariable Long id, @Valid @RequestBody CourseRequest request) { return courses.update(id, request); }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Activate / deactivate a course")
    public CourseResponse status(@PathVariable Long id, @Valid @RequestBody StatusRequest request) { return courses.updateStatus(id, request.status()); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete a course (ADMIN)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        courses.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/seats/reserve")
    @PreAuthorize("hasAnyRole('ADMIN','SERVICE')")
    @Operation(summary = "Reserve one seat for an enrollment (atomic, idempotent per enrollmentId)",
            description = "Used by Enrollment Service's saga. 409 when no seats are left or the course is inactive.")
    public SeatResponse reserve(@PathVariable Long id, @Valid @RequestBody SeatRequest request) { return seats.reserve(id, request.enrollmentId()); }

    @PostMapping("/{id}/seats/release")
    @PreAuthorize("hasAnyRole('ADMIN','SERVICE')")
    @Operation(summary = "Release the seat held by an enrollment (idempotent; compensating action)")
    public SeatResponse release(@PathVariable Long id, @Valid @RequestBody SeatRequest request) { return seats.release(id, request.enrollmentId()); }

    static Pageable pageable(int page, int size, String sort) {
        String[] p = sort.split(",");
        if (!SORTABLE.contains(p[0])) throw new IllegalArgumentException("Cannot sort by '" + p[0] + "'. Allowed: " + SORTABLE);
        Sort.Direction dir = p.length > 1 ? Sort.Direction.fromString(p[1]) : Sort.Direction.ASC;
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(dir, p[0]));
    }
}
