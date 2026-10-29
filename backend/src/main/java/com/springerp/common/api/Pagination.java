package com.springerp.common.api;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Sanitizes client-supplied paging: caps the page size and keeps only whitelisted
 * sort properties, so arbitrary entity paths can never reach the query layer.
 */
public final class Pagination {

    public static final int MAX_PAGE_SIZE = 100;

    private Pagination() {
    }

    public static Pageable sanitize(Pageable requested, Set<String> sortable, Sort defaultSort) {
        int size = Math.min(Math.max(requested.getPageSize(), 1), MAX_PAGE_SIZE);
        int page = Math.max(requested.getPageNumber(), 0);
        Sort sort = Sort.by(requested.getSort().stream()
                .filter(order -> sortable.contains(order.getProperty()))
                .toList());
        return PageRequest.of(page, size, sort.isSorted() ? sort : defaultSort);
    }

    /** Escapes LIKE wildcards and returns a lower-case contains pattern, or null when blank. */
    public static String likePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.trim().toLowerCase()
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
