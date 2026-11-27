package com.fooddelivery.restaurant.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import jakarta.validation.constraints.NotBlank;

/**
 * A plain Java record mapped by Spring Data R2DBC — no JPA/Hibernate
 * annotations or proxies involved. Field names are converted to snake_case
 * column names automatically (categoryName -> category_name).
 */
@Table("Categories")
public record Category(

        @Id
        Long categoryId,

        @NotBlank
        String categoryName,

        @NotBlank
        String categoryType,

        String description
) {
}
