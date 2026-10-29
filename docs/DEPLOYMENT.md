# Deployment

## Target topology

One Linux VM with Docker running four containers on a private network:
`caddy` (TLS) → `frontend` (nginx: SPA + `/api` proxy) → `backend` (Spring Boot) → `mysql`.
Only ports 80/443 (Caddy) are published. MySQL and the API are never reachable from outside.

## Prerequisites

- A VM with 2 vCPU / 4 GB RAM (enough for a few dozen users), Docker Engine 24+ with the
  Compose plugin, a domain name with an A record pointing to the VM, ports 80 and 443 open.
- Indicative cost: a 2 vCPU / 4 GB VM is roughly 10–25 EUR/month at mainstream cloud
  providers; certificates are free (Let's Encrypt via Caddy). Add off-site backup storage
  (a few EUR/month).

## First deployment

```bash
git clone <repo> springerp && cd springerp
cp .env.example .env
# Set strong values: MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, APP_JWT_SECRET (openssl rand -base64 48),
# APP_BOOTSTRAP_ADMIN_EMAIL, APP_BOOTSTRAP_ADMIN_PASSWORD, DOMAIN=erp.example.com, APP_COOKIE_SECURE=true
chmod 600 .env

docker compose --profile https up -d --build
docker compose logs -f backend      # wait for "Started SpringErpApplication"
```

Open `https://<DOMAIN>`, sign in with the bootstrap administrator, then remove
`APP_BOOTSTRAP_ADMIN_PASSWORD` from `.env` (it is only used while the users table is empty).

**Local Docker without TLS:** `docker compose up -d --build`, open `http://localhost:8081`,
and set `APP_COOKIE_SECURE=false` (browsers drop `Secure` cookies over plain http).

## Configuration per environment

| Profile | Use | Behaviour |
|---|---|---|
| *(default)* | Local development against MySQL | Reads `.env`; Swagger UI on |
| `local` | Development without MySQL | File-based H2, ephemeral JWT key, generated admin password |
| `test` | Automated tests | In-memory H2 |
| `prod` | Containers | JSON logs, Swagger off, demo data forced off, secure cookie, JWT secret mandatory |

## Database migrations

Flyway runs automatically when the backend starts, before the application accepts traffic
(the readiness probe stays down until then). A failed migration stops the startup and leaves
the previous schema intact (MySQL DDL is not transactional, so restore from the pre-deploy
backup if a migration fails half-way). Always back up before deploying a release with new
migrations.

## Upgrades

```bash
sh deploy/backup.sh
git pull
docker compose --profile https up -d --build
```

## Health and monitoring

- `GET /actuator/health/liveness` and `/readiness` (used by the container health checks).
- Logs: `docker compose logs backend`; in `prod` they are JSON with a `correlationId`,
  which the UI shows in error toasts ("Reference: …") for support.
- Audit trail: Administration → Audit log.

## Backup and restore

Back up the database and the documents volume together.

```bash
# deploy/backup.sh (abridged)
set -euo pipefail
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker compose exec -T mysql sh -c 'exec mysqldump --single-transaction --routines --triggers \
  -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' | gzip > "backups/db-$ts.sql.gz"
docker run --rm -v springerp_documents:/data -v "$PWD/backups":/backup alpine \
  tar czf "/backup/documents-$ts.tar.gz" -C /data .
```

Schedule it with cron (e.g. nightly), copy `backups/` off the server, and keep at least
7 daily and 4 weekly copies.

Restore (on an empty stack):

```bash
docker compose up -d mysql
gunzip -c backups/db-<ts>.sql.gz | docker compose exec -T mysql sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
docker run --rm -v springerp_documents:/data -v "$PWD/backups":/backup alpine \
  tar xzf "/backup/documents-<ts>.tar.gz" -C /data
docker compose --profile https up -d
```

Test a restore on a separate machine at least once per quarter.

## Hardening checklist

- [ ] `.env` is `chmod 600`, not committed, and holds unique strong secrets
- [ ] `APP_COOKIE_SECURE=true`, HTTPS only (Caddy redirects http → https)
- [ ] Only ports 80/443 open in the firewall; SSH key-only
- [ ] Bootstrap admin password removed from `.env` after first sign-in; admin password changed
- [ ] Nightly backups copied off-site; restore tested
- [ ] Dependabot PRs reviewed regularly; base images rebuilt monthly
