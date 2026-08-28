#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

node scripts/env.mjs check-prod
umask 077
mkdir -p backups
backup_path="backups/snapkit-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$backup_path"

if [[ ! -s "$backup_path" ]]; then
  echo "Backup is empty." >&2
  exit 1
fi

echo "Backup created: $backup_path"
