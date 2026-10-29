# Testing

## How to run

```bash
# Backend: unit + integration tests (H2 in MySQL mode, real Flyway migrations).
# MySqlMigrationTest also runs against MySQL 8 when Docker is available (always in CI).
cd backend && ./mvnw test

# Frontend quality gates
cd frontend
npm run lint        # ESLint (typescript-eslint, react-hooks)
npm run typecheck   # tsc, strict mode
npm test            # Vitest + Testing Library
npm run build       # production build

# End-to-end (Playwright, Chromium) against a running stack
npx playwright install chromium        # once
E2E_ADMIN_EMAIL=admin@… E2E_ADMIN_PASSWORD=… npm run e2e
```

Each E2E test signs in on its own: sharing a saved session between tests would replay an
already-rotated refresh token, which the API correctly treats as theft. Keep the suite under
the login rate limit (10 per minute per IP).

## What is covered

### Backend (JUnit 5, Spring Boot Test, MockMvc)

| Test | Proves |
|---|---|
| `PricingTest` | Line and document arithmetic, HALF_UP on exact halves, totals = sum of rounded lines |
| `LeaveWorkingDaysTest` | Working-day counting across weekends |
| `CsvWriterTest` | RFC 4180 quoting and spreadsheet formula-injection protection |
| `SecurityIntegrationTest` (14) | 401 for anonymous and forged tokens, deny-by-default, 403 per role, dashboard section filtering, HttpOnly/SameSite cookie, identical messages for unknown email vs wrong password, lockout, refresh rotation and reuse revocation, anti-CSRF header, logout revocation, temporary-password lock-down, validation errors, no self-deactivation |
| `SalesFlowIntegrationTest` (5) | Order-to-cash through the API: totals, stock deduction, invoice numbering, one active invoice per order, partial/over/exact payments, PDF; atomic rollback on insufficient stock; cancellation restocks; no negative manual issue; optimistic-lock 409 |
| `StockConcurrencyTest` | 12 simultaneous issues on 5 units: exactly 5 succeed, stock ends at 0, ledger has 5 entries |
| `LeaveAuthorizationTest` (2) | IDOR protection on leave requests, overlap refusal, no filing for others |
| `MySqlMigrationTest` | All migrations apply on MySQL 8 and Hibernate validates the schema (Testcontainers; skipped without Docker) |

All integration tests start the full application, so every run also validates that the
entity mappings match the Flyway schema.

### Frontend (Vitest, Testing Library)

| Test | Proves |
|---|---|
| `pricing.test.ts` | Client preview matches the server's arithmetic to the cent (same cases as `PricingTest`) |
| `format.test.ts` | Business dates never shift with the time zone; money and percentage formatting |
| `api.test.ts` | Bearer + anti-CSRF headers, single refresh and replay on 401, session end when refresh fails, problem-detail mapping |
| `login-page.test.tsx` | Client validation, server error display, redirect after sign-in |
| `data-table.test.tsx` | Rows, `aria-sort` and sort callbacks, empty and error states, paging |
| `guards.test.tsx` | Pages are hidden without the permission |

### End-to-end (Playwright)

| Test | Proves |
|---|---|
| quote → confirmed order → invoice → payment | Creates product and customer, builds a quote (preview and server totals both 129.60), confirms, invoices, rejects an overpayment, settles, and checks the stock went from 10 to 7 |
| navigation by role | Admin navigation entries and the in-shell not-found page |

## Latest results (actually executed)

| Date | Command | Result |
|---|---|---|
| 2026-10-29 | `./mvnw test` (Java 17, Windows) | 34 run, **33 passed**, 0 failed, 1 skipped (`MySqlMigrationTest`: no Docker locally) |
| 2026-10-29 | `npm run lint`, `npm run typecheck`, `npm run build` | all passed |
| 2026-10-29 | `npm test` | **24/24 passed** (6 files) |
| 2026-10-29 | `npm run e2e` against React + Spring Boot + MySQL 8.0.36 | **2/2 passed** |
| 2026-10-28 | Scripted API checks against MySQL 8.0.36 with demo data (login, RBAC per role, order-to-cash, PDF, CSV, notifications, refresh rotation/replay, validation format, rate limit) | **37/37 passed** |
| 2026-10-29 | `npm audit` | 0 vulnerabilities |

Not executed locally: `docker compose build` and the Testcontainers MySQL test (Docker is not
installed on the development machine); both run in GitHub Actions.

## Not covered yet

- Component tests for every form dialog (only the shared building blocks are covered).
- Load/performance tests.
- Accessibility automation (axe) in E2E.
