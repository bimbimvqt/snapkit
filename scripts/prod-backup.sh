#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

node scripts/env.mjs check-prod
umask 077
mkdir -p backups
backup_stamp="snapkit-$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="backups/$backup_stamp.sql.gz"
media_backup_path="backups/$backup_stamp.media.tar.gz"

docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$backup_path"

if [[ ! -s "$backup_path" ]]; then
  echo "Backup is empty." >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml exec -T backend \
  tar -czf - -C /app/media . > "$media_backup_path"

if [[ ! -s "$media_backup_path" ]]; then
  echo "Media backup is empty." >&2
  exit 1
fi

echo "Database backup created: $backup_path"
echo "Media backup created: $media_backup_path"
