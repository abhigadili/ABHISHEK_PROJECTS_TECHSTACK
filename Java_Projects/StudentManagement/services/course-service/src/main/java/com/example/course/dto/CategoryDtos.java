package com.example.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class CategoryDtos {
    private CategoryDtos() {}

    public record CategoryRequest(@NotBlank @Size(max = 80) String name, @Size(max = 255) String description) {}

    public record CategoryResponse(Long categoryId, String name, String description) {}
}
