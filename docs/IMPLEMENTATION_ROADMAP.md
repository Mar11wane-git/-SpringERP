# Implementation roadmap

Status as of 2026-10-29. `[x]` done and verified, `[ ]` open.

## Step 1 – Audit
- [x] Repository and environment audit (no existing SpringERP code; see PROJECT_AUDIT.md)
- [x] Feature matrix and prioritized plan

## Step 2 – Stabilize / bootstrap
- [x] Spring Boot 3.5.16 project on Java 17 with Maven Wrapper
- [x] React 19 + TypeScript strict + Vite 7 project
- [x] Externalized configuration (`.env`, profiles `local`/`test`/`prod`), `.gitignore`, `.env.example`

## Step 3 – Foundation
- [x] Flyway migrations V1–V4, `ddl-auto=validate`, verified on MySQL 8.0.36 and H2
- [x] RFC 7807 errors with codes and correlation ids; whitelisted sorting and capped paging
- [x] Spring Security: JWT access tokens, rotating refresh cookie with reuse detection, lockout, rate limit, RBAC
- [x] Audit log and in-app notifications
- [x] Design system: tokens, light/dark themes, accessible primitives, data table, validated chart palette
- [x] App shell: collapsible grouped sidebar, breadcrumbs, global search (Ctrl+K), notifications, user menu, theme toggle, mobile drawer

## Step 4 – Business modules
- [x] Users and roles administration
- [x] Company settings
- [x] Departments (tree), employees, status history, employment documents
- [x] Leave requests and approvals
- [x] Products, categories, stock ledger, receipts/issues/adjustments, low-stock alerts
- [x] Customers and suppliers with duplicate detection
- [x] Quotes and sales orders with transactional stock
- [x] Invoices, gap-free numbering, partial payments, PDF, CSV
- [x] Dashboard with live KPIs and period comparison
- [x] Reports: sales & cash, inventory valuation, headcount, CSV exports

## Step 5 – Integrate
- [x] Scripted API checks on MySQL with demo data (37/37)
- [x] Playwright E2E on React + Spring Boot + MySQL (2/2)
- [x] Visual review of key pages in light, dark and mobile layouts

## Step 6 – Production readiness
- [x] Dockerfiles (non-root), Compose with health checks, private MySQL, Caddy HTTPS profile
- [x] GitHub Actions: backend tests (incl. Testcontainers MySQL), frontend gates, image build, dependency review; Dependabot
- [x] Documentation set (README + docs/)
- [ ] Build and run the Docker images on a machine with Docker (not available on the dev machine; CI does it)

## Next tasks (prioritized)

1. **First CI run on GitHub** – push the repository and confirm the `docker` and Testcontainers jobs pass.
2. **Self-service password reset by e-mail** – needs an SMTP provider: token table, expiring
   single-use links, rate limiting.
3. **Purchase orders** – supplier orders that create stock receipts on reception (closes the procure-to-stock loop).
4. **Multiple stock locations and transfers** – `locations` table, per-location quantities, transfer movements.
5. **Credit notes** – reverse a paid invoice properly instead of only allowing cancellation of unpaid ones.
6. **PDF reports** and scheduled report e-mails.
7. **OWASP Dependency-Check** in CI (requires an NVD API key secret).
8. **More frontend tests** – form dialogs, axe accessibility checks in Playwright.
9. **MFA (TOTP)** for administrators.
10. **Multi-company tenancy** – only if required; would add a tenant id to every aggregate and repository query.

## Decisions requiring the owner's approval

- Default currency is EUR and time zone UTC in the seed row; change them in Company settings (e.g. MAD / Africa/Casablanca).
- Payroll is deliberately out of scope until legal and calculation requirements are defined.
