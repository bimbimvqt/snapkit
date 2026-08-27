#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

: "${GHCR_IMAGE_PREFIX:?GHCR_IMAGE_PREFIX is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${PUBLIC_URL:?PUBLIC_URL is required}"

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod uploaded by the GitHub production environment." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is unavailable or the deploy user cannot access it." >&2
  exit 1
fi

chmod 600 .env.prod

compose=(
  docker compose
  -f docker-compose.prod.yml
  -f docker-compose.github.yml
)

# Validate production secrets without requiring Node.js on the VPS.
docker run --rm \
  -v "$project_dir:/workspace:ro" \
  -w /workspace \
  node:22-alpine \
  node scripts/env.mjs check-prod

"${compose[@]}" config --quiet
"${compose[@]}" pull

previous_tag=""
state_file="$project_dir/.deployed-image-tag"
if [[ -f "$state_file" ]]; then
  previous_tag="$(tr -d '[:space:]' < "$state_file")"
fi

rollback() {
  local exit_code=$?
  trap - ERR
  if [[ -n "$previous_tag" && "$previous_tag" != "$IMAGE_TAG" ]]; then
    echo "Deployment failed. Rolling containers back to image tag $previous_tag." >&2
    export IMAGE_TAG="$previous_tag"
    "${compose[@]}" up -d --no-build --remove-orphans || true
  else
    echo "Deployment failed and no previous image tag is available for container rollback." >&2
  fi
  exit "$exit_code"
}
trap rollback ERR

# Keep a recoverable database snapshot before Prisma migrations when Postgres already exists.
if "${compose[@]}" ps --status running --services | grep -qx postgres; then
  umask 077
  mkdir -p backups
  backup_path="backups/toolbox-one-predeploy-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  "${compose[@]}" exec -T postgres \
    sh -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip -9 > "$backup_path"
  if [[ ! -s "$backup_path" ]]; then
    echo "Pre-deploy database backup is empty." >&2
    exit 1
  fi
  echo "Pre-deploy backup created: $backup_path"
fi

"${compose[@]}" up -d --no-build --remove-orphans

# Bind-mounted Nginx configuration can change without altering the container
# definition, so validate and reload it on every release.
"${compose[@]}" exec -T nginx nginx -t
"${compose[@]}" exec -T nginx nginx -s reload

healthy=false
for attempt in $(seq 1 45); do
  if curl --fail --silent --show-error "$PUBLIC_URL/healthz" >/dev/null && \
     curl --fail --silent --show-error "$PUBLIC_URL/api/health" >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != "true" ]]; then
  "${compose[@]}" ps
  "${compose[@]}" logs --tail=160
  echo "Production stack did not become healthy in time." >&2
  exit 1
fi

# Run the authenticated smoke suite from a disposable Node container.
docker run --rm \
  --network host \
  -v "$project_dir:/workspace:ro" \
  -w /workspace \
  -e ADMIN_URL="$PUBLIC_URL" \
  -e BACKEND_URL="$PUBLIC_URL" \
  -e SMOKE_ENV_FILE=.env.prod \
  node:22-alpine \
  node scripts/smoke.mjs

state_tmp="$state_file.tmp"
printf '%s\n' "$IMAGE_TAG" > "$state_tmp"
mv "$state_tmp" "$state_file"
chmod 600 "$state_file"
trap - ERR

"${compose[@]}" ps
echo "GitHub deployment is healthy at $PUBLIC_URL using image tag $IMAGE_TAG"
