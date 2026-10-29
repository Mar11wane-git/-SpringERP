package com.springerp.security;

import static com.springerp.security.Permission.*;

import java.util.EnumSet;
import java.util.Set;

/**
 * Roles map to permission sets in code: the mapping is versioned and reviewed with
 * the code that relies on it. Every user may file their own leave requests, which
 * needs no permission (ownership is checked in the service).
 */
public enum Role {
    ADMIN(EnumSet.allOf(Permission.class)),
    MANAGER(EnumSet.of(DASHBOARD_READ, EMPLOYEE_READ, LEAVE_APPROVE, INVENTORY_READ, INVENTORY_WRITE,
            PARTNER_READ, PARTNER_WRITE, SALES_READ, SALES_WRITE, INVOICE_READ, REPORT_READ, REPORT_FINANCIAL,
            AUDIT_READ)),
    HR(EnumSet.of(DASHBOARD_READ, EMPLOYEE_READ, EMPLOYEE_WRITE, LEAVE_APPROVE, REPORT_READ)),
    SALES(EnumSet.of(DASHBOARD_READ, INVENTORY_READ, PARTNER_READ, PARTNER_WRITE, SALES_READ, SALES_WRITE,
            INVOICE_READ, REPORT_READ)),
    WAREHOUSE(EnumSet.of(DASHBOARD_READ, INVENTORY_READ, INVENTORY_WRITE, STOCK_ADJUST, PARTNER_READ, SALES_READ,
            REPORT_READ)),
    ACCOUNTANT(EnumSet.of(DASHBOARD_READ, PARTNER_READ, SALES_READ, INVOICE_READ, INVOICE_WRITE, PAYMENT_WRITE,
            INVENTORY_READ, REPORT_READ, REPORT_FINANCIAL)),
    EMPLOYEE(EnumSet.of(DASHBOARD_READ));

    private final Set<Permission> permissions;

    Role(Set<Permission> permissions) {
        this.permissions = permissions;
    }

    public Set<Permission> permissions() {
        return permissions;
    }

    public boolean has(Permission permission) {
        return permissions.contains(permission);
    }
}
