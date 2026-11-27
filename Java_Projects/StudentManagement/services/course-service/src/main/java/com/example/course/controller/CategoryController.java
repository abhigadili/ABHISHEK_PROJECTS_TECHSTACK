package com.example.course.controller;

import com.example.course.dto.CategoryDtos.*;
import com.example.course.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/courses/categories")
@Tag(name = "Course categories")
public class CategoryController {
    private final CategoryService service;

    public CategoryController(CategoryService service) { this.service = service; }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Create a category")
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest r) {
        CategoryResponse c = service.create(r);
        return ResponseEntity.created(URI.create("/api/courses/categories/" + c.categoryId())).body(c);
    }

    @GetMapping
    @Operation(summary = "List categories")
    public List<CategoryResponse> list() { return service.list(); }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    @Operation(summary = "Update a category")
    public CategoryResponse update(@PathVariable Long id, @Valid @RequestBody CategoryRequest r) { return service.update(id, r); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete an unused category")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
