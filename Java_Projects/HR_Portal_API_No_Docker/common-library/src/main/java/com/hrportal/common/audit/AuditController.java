package com.hrportal.common.audit;

import java.util.Set;

import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hrportal.common.web.PageRequests;
import com.hrportal.common.web.PageResponse;

import io.swagger.v3.oas.annotations.tags.Tag;

/** Read-only audit API of a service: GET {hr.audit.base-path}/audit. There is deliberately no write endpoint. */
@Tag(name = "Audit History")
@RestController
@RequestMapping("${hr.audit.base-path}/audit")
public class AuditController {
    private static final Set<String> SORT = Set.of("createdAt", "entityType", "action");
    private final AuditHistoryRepository repository;

    public AuditController(AuditHistoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('HR_ADMIN','SUPER_ADMIN','FINANCE_ADMIN','PAYROLL_ADMIN')")
    public PageResponse<AuditHistory> search(@RequestParam(required = false) String entityType,
                                             @RequestParam(required = false) String entityId,
                                             @RequestParam(required = false) String action,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size,
                                             @RequestParam(defaultValue = "createdAt,desc") String sort) {
        Pageable pageable = PageRequests.of(page, size, sort, SORT, "createdAt");
        return PageResponse.of(repository.search(entityType, entityId, action, pageable));
    }
}
