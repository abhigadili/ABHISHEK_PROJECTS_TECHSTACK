package com.hrportal.common.web;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.hrportal.common.exception.BadRequestException;

/**
 * Builds a {@link Pageable} from request parameters. Sort fields are checked against an allowlist so a
 * caller can never inject an arbitrary column / expression into ORDER BY (SQL-injection hardening).
 * Sort syntax: {@code sort=field,asc|desc}.
 */
public final class PageRequests {
    public static final int MAX_PAGE_SIZE = 200;

    private PageRequests() {
    }

    public static Pageable of(int page, int size, String sort, Set<String> allowedFields, String defaultField) {
        if (page < 0) throw new BadRequestException("page must be >= 0");
        if (size < 1 || size > MAX_PAGE_SIZE) throw new BadRequestException("size must be between 1 and " + MAX_PAGE_SIZE);
        String field = defaultField;
        Sort.Direction dir = Sort.Direction.ASC;
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.split(",");
            field = parts[0].trim();
            if (parts.length > 1) {
                dir = "desc".equalsIgnoreCase(parts[1].trim()) ? Sort.Direction.DESC
                        : "asc".equalsIgnoreCase(parts[1].trim()) ? Sort.Direction.ASC : badDirection();
            }
        }
        if (!allowedFields.contains(field)) {
            throw new BadRequestException("Cannot sort by '" + field + "'. Allowed: " + allowedFields);
        }
        return PageRequest.of(page, size, Sort.by(dir, field));
    }

    private static Sort.Direction badDirection() {
        throw new BadRequestException("sort direction must be asc or desc");
    }
}
