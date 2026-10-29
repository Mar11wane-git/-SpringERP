#!/usr/bin/env sh
# Backs up the MySQL database and the employee-documents volume of the Compose stack.
# Run from the repository root:  sh deploy/backup.sh   (schedule nightly with cron)
set -eu

ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

docker compose exec -T mysql sh -c 'exec mysqldump --single-transaction --routines --triggers \
  -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' | gzip > "backups/db-$ts.sql.gz"

docker run --rm -v springerp_documents:/data -v "$PWD/backups":/backup alpine \
  tar czf "/backup/documents-$ts.tar.gz" -C /data .

echo "Backup written: backups/db-$ts.sql.gz, backups/documents-$ts.tar.gz"
