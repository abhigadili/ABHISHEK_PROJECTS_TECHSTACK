package com.fooddelivery.common.web;

import org.springframework.data.domain.Page;
import java.util.List;
import java.util.function.Function;

/** Stable JSON shape for paginated lists (Spring's PageImpl JSON is not a stable contract). */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    public static <E, T> PageResponse<T> of(Page<E> p, Function<E, T> mapper) {
        return new PageResponse<>(p.getContent().stream().map(mapper).toList(), p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }
}
