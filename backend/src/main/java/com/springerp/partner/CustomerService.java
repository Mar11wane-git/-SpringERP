package com.springerp.partner;

import com.springerp.audit.AuditService;
import com.springerp.numbering.DocumentNumberService;
import org.springframework.stereotype.Service;

@Service
public class CustomerService extends PartnerService<Customer> {

    public CustomerService(CustomerRepository repository, DocumentNumberService numbers, AuditService audit) {
        super(repository, numbers, audit, Customer::new, "Customer", "CUS");
    }
}
