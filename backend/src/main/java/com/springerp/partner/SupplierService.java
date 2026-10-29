package com.springerp.partner;

import com.springerp.audit.AuditService;
import com.springerp.numbering.DocumentNumberService;
import org.springframework.stereotype.Service;

@Service
public class SupplierService extends PartnerService<Supplier> {

    public SupplierService(SupplierRepository repository, DocumentNumberService numbers, AuditService audit) {
        super(repository, numbers, audit, Supplier::new, "Supplier", "SUP");
    }
}
