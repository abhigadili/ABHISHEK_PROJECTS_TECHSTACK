package com.hrportal.common.web;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

/** Standard paged payload: {@code content} plus paging metadata. */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages, boolean last) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.getContent().stream().map(mapper).toList(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    public static <T> PageResponse<T> of(Page<T> page) {
        return of(page, Function.identity());
    }

    public static <T> PageResponse<T> ofList(List<T> all, int page, int size) {
        int from = Math.min(page * size, all.size());
        int to = Math.min(from + size, all.size());
        int pages = size == 0 ? 0 : (int) Math.ceil(all.size() / (double) size);
        return new PageResponse<>(all.subList(from, to), page, size, all.size(), pages, to >= all.size());
    }
}
