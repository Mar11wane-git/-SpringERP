# Security

## Authentication

| Control | Implementation |
|---|---|
| Password storage | BCrypt via Spring's `DelegatingPasswordEncoder` (`{bcrypt}` prefix allows upgrades) |
| Password policy | 10–100 characters with letters and digits, enforced server-side (`UserDtos.PASSWORD_REGEX`) and mirrored in the UI |
| Access token | HS256 JWT, 15 min, issuer and expiry validated; claims: user id, email, role, `pwd_change`. Kept **in memory** by the SPA, never in `localStorage` |
| Refresh token | 256-bit random value, only its SHA-256 stored; HttpOnly, `Secure`, `SameSite=Strict`, `Path=/api/auth`, 7 days |
| Rotation & reuse detection | Each refresh revokes the presented token; presenting a revoked one revokes the whole session family (logged as `TOKEN_REUSE_DETECTED`) |
| Revocation | Logout, password change/reset, role change and deactivation revoke refresh tokens; access tokens expire within 15 min |
| Brute force | Account lock for 15 min after 5 failures; 10 login attempts/min per client IP (HTTP 429) |
| Enumeration | One generic message for unknown email, wrong password, locked or inactive account; a dummy hash comparison equalizes timing |
| Temporary passwords | Admin-issued passwords set `must_change_password`; the API rejects every non-auth call (`PASSWORD_CHANGE_REQUIRED`) until changed |
| Signing key | `APP_JWT_SECRET` (≥ 32 bytes) required in every profile except `local`, which generates an ephemeral key |

## Authorization

- **Deny by default:** any path not explicitly opened needs a valid token; unknown paths
  outside `/api` are denied.
- **Permission checks** with `@PreAuthorize` on every controller method; roles map to
  permissions in `Role.java`.
- **Object-level checks (IDOR):** leave requests are filtered to the caller's own employee
  record unless they hold `LEAVE_APPROVE`/`EMPLOYEE_READ`; foreign IDs return 404, not 403.
  Notifications are always scoped to the recipient. Employee documents are fetched by
  `(document id, employee id)`.
- **Sensitive data:** employee documents need `EMPLOYEE_WRITE`; revenue figures need
  `REPORT_FINANCIAL`; the dashboard omits sections the caller may not see.
- **Business guards:** no self-deactivation, at least one active admin, no self-approval of leave.
- The frontend hides what a role cannot use, but every rule is enforced by the API.
  `SecurityIntegrationTest` and `LeaveAuthorizationTest` prove it.

## CSRF and CORS

API calls authenticate with the `Authorization` header, which browsers never attach on
their own, so CSRF tokens are unnecessary for them. The only cookie (refresh) is
`SameSite=Strict`, path-scoped, and the two endpoints that read it require the
`X-Requested-With` header, which a cross-site form cannot send. CORS is off by default
(same-origin deployment); `APP_CORS_ALLOWED_ORIGINS` enables an explicit allow-list.

## Input, files and output

- Bean Validation on every request DTO; JPQL with bound parameters only; LIKE wildcards escaped;
  sort properties whitelisted; page size capped at 100.
- Uploads: 5 MB cap (multipart + explicit check); type decided from **magic bytes** (PDF,
  PNG, JPEG only); files stored under random UUID names; resolved path verified to stay in
  the storage root; original name sanitized for display; served as attachment with
  `nosniff`.
- CSV exports neutralize spreadsheet formula injection (`=`, `+`, `-`, `@` prefixes) and are audited.
- Errors never include stack traces, SQL or constraint names (`server.error.include-*=never`,
  `GlobalExceptionHandler`).

## Headers and transport

nginx sets a strict Content-Security-Policy (no inline or third-party scripts),
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` and a restrictive
`Permissions-Policy`. Spring Security adds HSTS on HTTPS requests. Production runs behind
TLS (Caddy profile with automatic certificates). nginx **overwrites** `X-Forwarded-For` with
the connecting address so clients cannot spoof their IP; if another proxy sits in front,
trust only that proxy (`set_real_ip_from`, see `frontend/nginx.conf`).

## Secrets and logging

- Secrets come from environment variables or a git-ignored `.env`; `.env.example` holds
  placeholders only. Nothing is hardcoded.
- Logs carry a correlation id; passwords, tokens and hashes are never logged. The only
  exception is the `local` development profile, which prints a one-time generated admin
  password once at first start.
- `prod` profile: JSON (ECS) logs, Swagger UI disabled, demo data forced off.

## Auditing

`audit_events` records sign-ins (success/failure), lockouts, token reuse, password
changes/resets, user and role changes, company settings, employee and document changes,
leave decisions, stock movements, order and invoice lifecycle, payments and data exports,
with actor, IP and correlation id. Failed logins are written in their own transaction so
they survive the rollback of the failed request.

## Dependency hygiene

- `npm audit` (2026-10-29): **0 vulnerabilities**, production and development dependencies.
- CI runs `npm audit --omit=dev --audit-level=high` and GitHub dependency review on pull
  requests; Dependabot proposes weekly updates for Maven, npm, Actions and base images.
- Not done: an OWASP Dependency-Check scan of the Maven tree (needs an NVD API key);
  listed in the roadmap.

## Known limitations

- The login rate limiter is in-memory, per instance. With several API instances, move it to
  the reverse proxy or a shared store.
- An access token stays valid up to 15 minutes after deactivation (refresh is revoked
  immediately). Lower `APP_ACCESS_TOKEN_TTL` if that window is too long.
- No multi-factor authentication yet.
