#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ "${1:-}" == "--" ]]; then
  shift
fi
backup_path="${1:-}"
if [[ -z "$backup_path" || ! -f "$backup_path" ]]; then
  echo "Usage: RESTORE_CONFIRM=snapkit bash scripts/prod-restore.sh backups/file.sql.gz" >&2
  exit 1
fi
if [[ "${RESTORE_CONFIRM:-}" != "snapkit" ]]; then
  echo "Restore replaces current database objects. Set RESTORE_CONFIRM=snapkit to continue." >&2
  exit 1
fi

node scripts/env.mjs check-prod
gzip -cd "$backup_path" | docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'

media_backup_path="${backup_path%.sql.gz}.media.tar.gz"
if [[ -f "$media_backup_path" ]]; then
  docker compose -f docker-compose.prod.yml run --rm --no-deps -T backend \
    sh -c 'rm -rf /app/media/* && tar -xzf - -C /app/media' < "$media_backup_path"
  echo "Media restored from $media_backup_path"
else
  echo "No companion media backup found at $media_backup_path; database only was restored."
fi

echo "Restore completed from $backup_path"
