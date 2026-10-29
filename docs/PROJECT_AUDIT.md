# Project audit

## Starting point (2026-10-28)

The brief asked to audit and transform an existing "SpringERP" repository. **No such
repository existed:** the working directory was empty and a search of the machine found
no ERP or Spring Boot project. The only Maven project found (`Downloads/ProjectJ`) is an
unrelated servlet/JSP user-CRUD exercise. With the owner's agreement, SpringERP was built
from scratch, so this document records the environment audit and the resulting feature
matrix instead of a code audit. No existing feature or data could be broken.

## Environment audit

| Item | Finding | Consequence |
|---|---|---|
| Java | Temurin 17.0.18 (no 21) | Target Java 17; Spring Boot 3.5.x supports it |
| Maven | Not on PATH | Maven Wrapper committed (`mvnw`) |
| Node.js | v24.21, npm 11.0.0 | npm 11.0.0 crashes on some peer sets; newer npm used via `npx` |
| MySQL | 8.0.36 service, database `Entreprise` (empty, utf8mb4) | Used for real verification; Flyway initialised it |
| Docker | Not installed | Dockerfiles/Compose written and the Compose file reviewed, but images were **not built locally**; CI builds them |
| Network | Maven Central and npm reachable | Exact, recent dependency versions pinned |

## Feature matrix

Status legend: **Done** = implemented end-to-end (schema, API, UI, permissions, tests where
noted). **Partial** = usable with documented limits. **Not done** = intentionally deferred.

| Requirement | Status | Notes |
|---|---|---|
| Login / logout | Done | JWT access token (15 min) in memory + rotating HttpOnly refresh cookie |
| User management, activation/deactivation | Done | Self-deactivation and removing the last admin are refused |
| Password change | Done | Ends other sessions |
| Password reset | Partial | Administrator-issued temporary password, forced change at next login. Self-service e-mail reset needs an SMTP provider (not configured) |
| Role-based permissions | Done | 7 roles → 20 permissions, enforced with `@PreAuthorize` and object-level checks |
| Login failure handling & auditing | Done | Lockout after 5 failures (15 min), 10 logins/min/IP, generic error message, audit events |
| Company profile & settings | Done | Currency, time zone ("today"), tax rate, payment terms, invoice footer |
| Departments & org structure | Done | Tree with cycle prevention, managers, headcount |
| Employee records, job titles, status history | Done | Status changes recorded in `employee_status_history` |
| Products, categories, SKUs, units | Done | |
| Suppliers & contacts | Done | Shared partner model with customers |
| Stock locations & transfers | Not done | Single stock location; see roadmap |
| Receipts, issues, adjustments | Done | Immutable ledger with resulting balance |
| Minimum stock thresholds & alerts | Done | Dashboard, filter and notification when the threshold is crossed |
| Concurrent stock protection | Done | Row lock + optimistic versions; tested with 12 parallel requests |
| Customer/supplier duplicate detection | Done | Unique email & tax ID; same-name-same-city warning with explicit override |
| Quotes and sales orders, line items, discounts | Done | Draft = quote |
| Transactional stock updates | Done | All-or-nothing confirmation; cancellation returns stock |
| Invoices, unique numbering, due dates | Done | Gap-free per-year numbering under row lock |
| Partial payments, balances | Done | Overpayment refused under row lock |
| Printable PDF invoices | Done | Server-side (OpenPDF) from the invoice snapshot |
| Leave requests & approvals | Done | Working days, overlap checks, no self-approval, IDOR-safe |
| Employment documents | Done | Magic-byte type check, 5 MB cap, random storage names |
| Payroll | Not done | Out of scope without legal and calculation requirements |
| Reports with date ranges & CSV | Done | Sales & cash, inventory valuation, headcount; exports audited |
| PDF reports | Not done | CSV only (invoices have PDFs) |
| In-app notifications, read/unread | Done | |
| Audit log, searchable, access-controlled | Done | `AUDIT_READ` only |
| Multi-company tenancy | Not done | Single-company deployment by design (see ARCHITECTURE.md) |

## Main risks and how they are addressed

| Risk | Mitigation |
|---|---|
| Overselling stock under concurrency | `SELECT … FOR UPDATE` on the product row, CHECK `quantity_on_hand >= 0`, concurrency test |
| Money rounding errors | `BigDecimal`/`DECIMAL(19,2)`, HALF_UP per line, identical integer-cent preview in the UI, unit tests on both sides |
| Token theft from browser storage | Access token only in memory; refresh token HttpOnly, SameSite=Strict, path-scoped, rotated, reuse-detected |
| Schema drift between H2 tests and MySQL | Same Flyway scripts on both; MySQL Testcontainers test in CI; verified against MySQL 8.0.36 locally |
| Untested Docker artefacts | CI builds both images and validates Compose on every push |
