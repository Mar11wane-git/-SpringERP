package com.springerp.audit;

import java.time.LocalDate;

import com.springerp.audit.AuditService.AuditEventResponse;
import com.springerp.common.api.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Audit log")
@RestController
@RequestMapping("/api/audit-events")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService service;

    @GetMapping
    @PreAuthorize("hasAuthority('AUDIT_READ')")
    public PageResponse<AuditEventResponse> search(@RequestParam(required = false) String search,
            @RequestParam(required = false) AuditAction action, @RequestParam(required = false) String entityType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Pageable pageable) {
        return service.search(search, action, entityType, from, to, pageable);
    }
}
