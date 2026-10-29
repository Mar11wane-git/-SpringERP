package com.springerp.security;

/** Fine-grained authorities checked on the server with {@code @PreAuthorize}. */
public enum Permission {
    DASHBOARD_READ,
    USER_READ,
    USER_WRITE,
    AUDIT_READ,
    COMPANY_WRITE,
    EMPLOYEE_READ,
    EMPLOYEE_WRITE,
    LEAVE_APPROVE,
    INVENTORY_READ,
    INVENTORY_WRITE,
    STOCK_ADJUST,
    PARTNER_READ,
    PARTNER_WRITE,
    SALES_READ,
    SALES_WRITE,
    INVOICE_READ,
    INVOICE_WRITE,
    PAYMENT_WRITE,
    REPORT_READ,
    REPORT_FINANCIAL
}
