#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

node scripts/env.mjs check-prod

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running or the current user cannot access it." >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

public_url="${PUBLIC_URL:-http://127.0.0.1}"
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "$public_url/healthz" >/dev/null && \
     curl --fail --silent --show-error "$public_url/api/health" >/dev/null; then
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    docker compose -f docker-compose.prod.yml ps
    docker compose -f docker-compose.prod.yml logs --tail=120
    echo "Production stack did not become healthy in time." >&2
    exit 1
  fi
  sleep 2
done

SMOKE_ENV_FILE=.env.prod ADMIN_URL="$public_url" BACKEND_URL="$public_url" node scripts/smoke.mjs
docker compose -f docker-compose.prod.yml ps
echo "Deployment is healthy at $public_url"
