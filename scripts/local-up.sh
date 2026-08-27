#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

node scripts/env.mjs init-local
pnpm install --frozen-lockfile

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop or OrbStack, then run this command again." >&2
  exit 1
fi

docker compose -f docker-compose.dev.yml up -d --build --remove-orphans
docker compose -f docker-compose.dev.yml ps
node scripts/smoke.mjs
