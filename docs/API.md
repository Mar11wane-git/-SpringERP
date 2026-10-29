# API

Base path `/api`. Interactive documentation (non-`prod` profiles): Swagger UI at
`/api/docs/ui`, OpenAPI JSON at `/api/docs`.

## Conventions

- **Auth:** `Authorization: Bearer <accessToken>` on every endpoint except login, refresh,
  logout and health. Cookie-authenticated endpoints (`/api/auth/refresh`, `/api/auth/logout`)
  also require `X-Requested-With: XMLHttpRequest`.
- **JSON:** ISO-8601 dates (`2026-10-28`) and instants (`2026-10-28T21:05:00Z`); money as
  JSON numbers with 2 decimals (send strings such as `"12.50"` for exact input).
- **Lists:** `?page=0&size=20&sort=name,asc` plus filters. Size is capped at 100 and only
  whitelisted sort properties are honoured. Response:
  `{ "content": [...], "page": 0, "size": 20, "totalElements": 135, "totalPages": 7 }`.
- **Concurrency:** editable resources expose `version`; send it back on `PUT` to get a `409
  CONCURRENT_MODIFICATION` instead of overwriting someone else's change.
- **Status codes:** `200` read/update, `201` create, `204` no content, `400` validation,
  `401` unauthenticated, `403` forbidden, `404` not found (also for records you may not see),
  `409` state conflict/duplicate, `413` file too large, `422` business rule, `429` rate limit.

### Error format (RFC 7807)

```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Insufficient stock for ELE-DOCK-USBC: 1 pcs available, 3 requested.",
  "code": "INSUFFICIENT_STOCK",
  "correlationId": "5f0c1c8e-3d1b-4f6a-9a4e-2b7f0f2d9c11",
  "errors": [{ "field": "lines[0].quantity", "message": "must be greater than or equal to 1" }]
}
```

`code` is stable and machine-readable; `errors` appears on validation failures. Stack
traces, SQL and constraint names are never returned.

## Endpoints

| Method & path | Permission | Purpose |
|---|---|---|
| `POST /api/auth/login` | public (rate-limited) | Returns `{accessToken, expiresAt, user}` and sets the refresh cookie |
| `POST /api/auth/refresh` | refresh cookie | Rotates the refresh token, returns a new access token |
| `POST /api/auth/logout` | refresh cookie | Revokes the refresh token, clears the cookie |
| `POST /api/auth/change-password` | authenticated | Changes the password, revokes other sessions, returns new tokens |
| `GET /api/auth/me` | authenticated | Profile, role, permissions, linked employee |
| `GET/POST /api/users`, `GET/PUT /api/users/{id}` | `USER_READ` / `USER_WRITE` | User administration |
| `PATCH /api/users/{id}/active`, `POST /api/users/{id}/reset-password` | `USER_WRITE` | Activate/deactivate, issue temporary password |
| `GET /api/company` · `PUT /api/company` | authenticated · `COMPANY_WRITE` | Company profile and defaults |
| `GET /api/departments` · `POST/PUT` | authenticated · `EMPLOYEE_WRITE` | Organization tree |
| `GET /api/employees`, `GET /api/employees/{id}` | `EMPLOYEE_READ` | Search by name/email/number/title, department, status |
| `POST /api/employees`, `PUT /{id}`, `POST /{id}/status` | `EMPLOYEE_WRITE` | Create, update, change employment status |
| `GET /api/employees/{id}/status-history` | `EMPLOYEE_READ` | Status history |
| `GET/POST /api/employees/{id}/documents`, `GET/DELETE …/{documentId}` | `EMPLOYEE_WRITE` | Employment documents (multipart upload, `category` param) |
| `GET /api/leave-requests` | authenticated | Own requests, or all with `LEAVE_APPROVE`/`EMPLOYEE_READ` (`mine`, `status`, `employeeId`) |
| `POST /api/leave-requests` | authenticated | Request leave (for others: `EMPLOYEE_WRITE`) |
| `POST /api/leave-requests/{id}/approve` · `/reject` | `LEAVE_APPROVE` | Decide (not on your own request) |
| `POST /api/leave-requests/{id}/cancel` | owner or `LEAVE_APPROVE` | Cancel |
| `GET /api/categories` · `POST/PUT/DELETE` | `INVENTORY_READ` · `INVENTORY_WRITE` | Product categories |
| `GET /api/products` | `INVENTORY_READ` | Filters: `search`, `categoryId`, `supplierId`, `active`, `lowStock` |
| `GET /api/products/export` | `INVENTORY_READ` + `REPORT_READ` | CSV (audited) |
| `POST /api/products`, `PUT /api/products/{id}` | `INVENTORY_WRITE` | Create (with optional opening stock) / update |
| `GET /api/products/{id}/stock-movements` | `INVENTORY_READ` | Ledger of one product |
| `POST /api/products/{id}/stock-movements` | `INVENTORY_WRITE` (receipt) / `STOCK_ADJUST` (issue, adjustment) | Manual stock movement |
| `GET /api/stock-movements` | `INVENTORY_READ` | Company-wide ledger (`type`, `from`, `to`) |
| `GET/POST /api/customers`, `/api/suppliers`; `GET/PUT …/{id}` | `PARTNER_READ` / `PARTNER_WRITE` | Partners (`ignoreDuplicateWarning` to override a `POSSIBLE_DUPLICATE`) |
| `GET /api/sales-orders`, `GET /{id}` | `SALES_READ` | Filters: `search`, `status`, `customerId`, `from`, `to` |
| `POST /api/sales-orders`, `PUT /{id}` | `SALES_WRITE` | Create / edit a draft |
| `POST /api/sales-orders/{id}/confirm` · `/complete` · `/cancel` | `SALES_WRITE` | Lifecycle (confirm deducts stock, cancel returns it) |
| `GET /api/invoices`, `GET /{id}`, `GET /{id}/pdf` | `INVOICE_READ` | Filters: `search`, `status`, `customerId`, `overdue`, `from`, `to` |
| `GET /api/invoices/export` | `INVOICE_READ` + `REPORT_READ` | CSV (audited) |
| `POST /api/invoices` | `INVOICE_WRITE` | Issue an invoice for a confirmed/completed order |
| `POST /api/invoices/{id}/payments` | `PAYMENT_WRITE` | Record a received payment (partial allowed) |
| `POST /api/invoices/{id}/cancel` | `INVOICE_WRITE` | Cancel an unpaid invoice |
| `GET /api/dashboard?from&to` | `DASHBOARD_READ` | KPIs; sections returned only when permitted |
| `GET /api/reports/sales[/export]?from&to` | `REPORT_FINANCIAL` | Monthly booked/invoiced/collected/purchases, top products |
| `GET /api/reports/inventory[/export]` | `REPORT_READ` + `INVENTORY_READ` | Valuation by product and category |
| `GET /api/reports/hr` | `REPORT_READ` + `EMPLOYEE_READ` | Headcount by department |
| `GET /api/notifications`, `/unread-count`; `POST /{id}/read`, `/read-all` | authenticated (own only) | In-app notifications |
| `GET /api/audit-events` | `AUDIT_READ` | Filters: `search`, `action`, `entityType`, `from`, `to` |
| `GET /api/search?q=` | authenticated | Global search across modules the caller can read |
| `GET /actuator/health[/liveness|/readiness]`, `/actuator/info` | public | Health probes |

## Roles

| Role | Typical permissions |
|---|---|
| `ADMIN` | Everything |
| `MANAGER` | Sales, inventory, partners, invoices (read), reports incl. financial, leave approval, audit read |
| `HR` | Employees (read/write), documents, leave approval, reports |
| `SALES` | Customers, quotes/orders, inventory read, invoice read |
| `WAREHOUSE` | Products, receipts, issues, adjustments, partners read |
| `ACCOUNTANT` | Invoices, payments, financial reports, sales and inventory read |
| `EMPLOYEE` | Own leave requests and the directory |

The exact mapping is `backend/src/main/java/com/springerp/security/Role.java`.
