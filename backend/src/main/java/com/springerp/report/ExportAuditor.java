package com.springerp.report;

import com.springerp.audit.AuditAction;
import com.springerp.audit.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Bulk data leaving the system is always audited. */
@Component
@RequiredArgsConstructor
public class ExportAuditor {

    private final AuditService audit;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String dataset, int rows) {
        audit.record(AuditAction.DATA_EXPORTED, "Export", dataset, "Exported " + rows + " row(s) of " + dataset);
    }
}
