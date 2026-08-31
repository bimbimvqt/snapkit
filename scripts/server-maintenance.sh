#!/usr/bin/env bash
set -Eeuo pipefail

mode="${MAINTENANCE_MODE:-inventory}"
confirmation="${MAINTENANCE_CONFIRM:-}"
database_volumes_b64="${DATABASE_VOLUMES_B64:-}"

protected_volumes=(
  snapkit_postgres_prod
  snapkit_media_prod
  snapkit_postgres_dev
  snapkit_caddy_data
  snapkit_caddy_config
)

is_protected_volume() {
  local candidate="$1"
  local protected
  for protected in "${protected_volumes[@]}"; do
    if [[ "$candidate" == "$protected" ]]; then
      return 0
    fi
  done
  return 1
}

print_inventory() {
  echo "Disk usage"
  df -h /
  echo

  echo "Docker disk usage"
  docker system df
  echo

  echo "Containers"
  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Mounts}}'
  echo

  echo "Non-SnapKit container ownership"
  local container_id container_name
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    container_name="$(docker inspect "$container_id" --format '{{.Name}}' | sed 's#^/##')"
    if [[ "$container_name" == snapkit-prod-* ]]; then
      continue
    fi
    docker inspect "$container_id" --format \
      'Name={{.Name}} Image={{.Config.Image}} Project={{index .Config.Labels "com.docker.compose.project"}} WorkingDir={{index .Config.Labels "com.docker.compose.project.working_dir"}} ConfigFiles={{index .Config.Labels "com.docker.compose.project.config_files"}}'
    docker inspect "$container_id" --format \
      'Mounts={{range .Mounts}}{{.Type}}:{{.Source}}->{{.Destination}};{{end}}'
    docker inspect "$container_id" --format \
      'Networks={{range $name, $settings := .NetworkSettings.Networks}}{{$name}};{{end}}'
    docker port "$container_id" || true
  done < <(docker ps -aq)
  echo

  echo "Docker networks"
  docker network ls --format 'table {{.Name}}\t{{.Driver}}\t{{.Scope}}'
  echo

  echo "Top-level application directories"
  find /opt -mindepth 1 -maxdepth 3 -type d -printf '%p\n' 2>/dev/null | sort || true
  echo

  echo "Volumes and attachment count"
  local volume attachment_count
  while IFS= read -r volume; do
    [[ -n "$volume" ]] || continue
    attachment_count="$(docker ps -aq --filter "volume=$volume" | wc -l | tr -d '[:space:]')"
    printf '%s\t%s container(s)\n' "$volume" "$attachment_count"
  done < <(docker volume ls --format '{{.Name}}' | sort)
  echo

  echo "Portainer resources"
  docker ps -a --format '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}' \
    | awk 'tolower($0) ~ /portainer/' || true
  docker volume ls --format '{{.Name}}' \
    | awk 'tolower($0) ~ /portainer/' || true
  echo

  echo "Unused PostgreSQL-looking volumes"
  while IFS= read -r volume; do
    [[ -n "$volume" ]] || continue
    if is_protected_volume "$volume"; then
      continue
    fi
    if [[ -n "$(docker ps -aq --filter "volume=$volume")" ]]; then
      continue
    fi
    if docker run --rm -v "$volume:/data:ro" postgres:17-alpine \
      sh -c 'test -s /data/PG_VERSION && test -d /data/base' >/dev/null 2>&1; then
      printf '%s\n' "$volume"
    fi
  done < <(docker volume ls --format '{{.Name}}' | sort)
}

print_sync_diagnostics() {
  echo "SnapKit media sync diagnostics"
  if ! docker container inspect snapkit-prod-postgres-1 >/dev/null 2>&1; then
    echo "SnapKit PostgreSQL container is unavailable."
    return 1
  fi
  docker exec -i snapkit-prod-postgres-1 \
    sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<'SQL'
SELECT
  (SELECT COUNT(*) FROM "User") AS users,
  (SELECT COUNT(*) FROM "MediaScan") AS scans,
  (SELECT COUNT(*) FROM "MediaScanAsset") AS assets,
  (SELECT COUNT(*) FROM "MediaScanAsset" WHERE "previewStorageKey" IS NOT NULL) AS previews,
  (SELECT MAX("createdAt") FROM "MediaScan") AS latest_scan;

SELECT
  COALESCE(u.email, 'anonymous') AS owner,
  COUNT(DISTINCT s.id) AS scans,
  COUNT(a.id) AS assets,
  MAX(s."createdAt") AS latest_scan
FROM "MediaScan" s
LEFT JOIN "User" u ON u.id = s."userId"
LEFT JOIN "MediaScanAsset" a ON a."scanId" = s.id
GROUP BY COALESCE(u.email, 'anonymous')
ORDER BY latest_scan DESC;
SQL
}

remove_portainer() {
  local container_id container_name volume
  mapfile -t portainer_containers < <(
    docker ps -a --format '{{.ID}}\t{{.Names}}\t{{.Image}}' \
      | awk 'tolower($0) ~ /portainer/ { print $1 }'
  )

  for container_id in "${portainer_containers[@]}"; do
    [[ -n "$container_id" ]] || continue
    container_name="$(docker inspect "$container_id" --format '{{.Name}}' | sed 's#^/##')"
    echo "Removing Portainer container: $container_name"
    docker container rm --force "$container_id"
  done

  while IFS= read -r volume; do
    [[ -n "$volume" ]] || continue
    if [[ -n "$(docker ps -aq --filter "volume=$volume")" ]]; then
      echo "Refusing to remove Portainer volume still attached to a container: $volume" >&2
      exit 1
    fi
    echo "Removing Portainer volume: $volume"
    docker volume rm "$volume"
  done < <(docker volume ls --format '{{.Name}}' | awk 'tolower($0) ~ /portainer/')
}

remove_database_volumes() {
  local decoded volume
  if [[ -z "$database_volumes_b64" ]]; then
    echo "No unused database volumes selected."
    return
  fi

  decoded="$(printf '%s' "$database_volumes_b64" | base64 --decode)"
  for volume in $decoded; do
    if [[ ! "$volume" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
      echo "Invalid Docker volume name: $volume" >&2
      exit 1
    fi
    if is_protected_volume "$volume"; then
      echo "Refusing to remove protected volume: $volume" >&2
      exit 1
    fi
    if ! docker volume inspect "$volume" >/dev/null 2>&1; then
      echo "Requested database volume does not exist: $volume" >&2
      exit 1
    fi
    if [[ -n "$(docker ps -aq --filter "volume=$volume")" ]]; then
      echo "Refusing to remove database volume attached to a container: $volume" >&2
      exit 1
    fi
    if ! docker run --rm -v "$volume:/data:ro" postgres:17-alpine \
      sh -c 'test -s /data/PG_VERSION && test -d /data/base' >/dev/null 2>&1; then
      echo "Refusing to remove a volume that is not recognizable PostgreSQL data: $volume" >&2
      exit 1
    fi
    echo "Removing unused PostgreSQL volume: $volume"
    docker volume rm "$volume"
  done
}

verify_production() {
  local required_container
  for required_container in \
    snapkit-prod-postgres-1 \
    snapkit-prod-backend-1 \
    snapkit-prod-admin-1 \
    snapkit-prod-nginx-1; do
    if [[ "$(docker inspect "$required_container" --format '{{.State.Status}}' 2>/dev/null || true)" != "running" ]]; then
      echo "Production container is not running: $required_container" >&2
      exit 1
    fi
  done

  curl --fail --silent --show-error \
    https://snapkit.45-119-214-94.sslip.io/healthz >/dev/null
  curl --fail --silent --show-error \
    https://snapkit.45-119-214-94.sslip.io/api/health >/dev/null
  echo "SnapKit production health checks passed."
}

restore_legacy_ingress() {
  echo "Restoring the legacy Caddy ingress after migration failure." >&2
  docker container rm --force snapkit-prod-edge-1 >/dev/null 2>&1 || true
  docker container start backend-caddy-1 >/dev/null
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error \
      https://snapkit.45-119-214-94.sslip.io/healthz >/dev/null 2>&1; then
      echo "Legacy ingress restored." >&2
      return 0
    fi
    sleep 2
  done
  echo "Legacy ingress could not be restored." >&2
  return 1
}

migrate_snapkit_ingress() {
  local image_tag healthy attempt
  local -a compose

  : "${GHCR_IMAGE_PREFIX:?GHCR_IMAGE_PREFIX is required for ingress migration}"
  if [[ ! -s .deployed-image-tag ]]; then
    echo "Missing SnapKit deployed image tag." >&2
    exit 1
  fi
  image_tag="$(tr -d '[:space:]' < .deployed-image-tag)"
  if [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid SnapKit deployed image tag." >&2
    exit 1
  fi

  compose=(docker compose -f docker-compose.prod.yml -f docker-compose.github.yml)
  export IMAGE_TAG="$image_tag"
  export GHCR_IMAGE_PREFIX
  "${compose[@]}" config --quiet
  docker pull caddy:2.10-alpine

  if ! docker container inspect backend-caddy-1 >/dev/null 2>&1; then
    echo "Legacy MAM Caddy container was not found; refusing an unverified ingress migration." >&2
    exit 1
  fi

  echo "Stopping the legacy MAM Caddy ingress."
  docker container stop backend-caddy-1 >/dev/null
  if ! "${compose[@]}" up -d --no-build --no-deps edge; then
    restore_legacy_ingress
    exit 1
  fi

  healthy=false
  for attempt in $(seq 1 60); do
    if curl --fail --silent --show-error \
      https://snapkit.45-119-214-94.sslip.io/healthz >/dev/null 2>&1 && \
      curl --fail --silent --show-error \
      https://snapkit.45-119-214-94.sslip.io/api/health >/dev/null 2>&1; then
      healthy=true
      break
    fi
    sleep 2
  done
  if [[ "$healthy" != "true" ]]; then
    "${compose[@]}" logs --tail=120 edge || true
    restore_legacy_ingress
    exit 1
  fi

  echo "SnapKit dedicated Caddy ingress is healthy."
  docker container rm backend-caddy-1 >/dev/null
}

remove_mam_resources() {
  local container volume network
  local -a mam_containers mam_volumes mam_networks
  mam_containers=(
    admin-admin-1
    backend-api-1
    mam-dev-admin-1
    mam-dev-api-1
    mam-dev-postgres-1
    postgres-global
  )
  mam_volumes=(
    backend_caddy_config
    backend_caddy_data
    mam-dev_mam_dev_postgres_data
    postgres_global_data
  )
  mam_networks=(
    backend_default
    mam-dev_internal
    mam_edge
    postgres-global_default
  )

  for container in "${mam_containers[@]}"; do
    if docker container inspect "$container" >/dev/null 2>&1; then
      echo "Removing MAM container: $container"
      docker container rm --force "$container"
    fi
  done

  if docker network inspect mam_edge >/dev/null 2>&1 && \
     docker container inspect snapkit-prod-nginx-1 >/dev/null 2>&1; then
    docker network disconnect --force mam_edge snapkit-prod-nginx-1 >/dev/null 2>&1 || true
  fi

  for volume in "${mam_volumes[@]}"; do
    if ! docker volume inspect "$volume" >/dev/null 2>&1; then
      continue
    fi
    if is_protected_volume "$volume"; then
      echo "Refusing to remove protected volume: $volume" >&2
      exit 1
    fi
    if [[ -n "$(docker ps -aq --filter "volume=$volume")" ]]; then
      echo "Refusing to remove MAM volume still attached to a container: $volume" >&2
      exit 1
    fi
    echo "Removing MAM volume: $volume"
    docker volume rm "$volume"
  done

  for network in "${mam_networks[@]}"; do
    if docker network inspect "$network" >/dev/null 2>&1; then
      echo "Removing MAM network: $network"
      docker network rm "$network"
    fi
  done

  echo "Removing MAM application files and postgres-global configuration."
  docker pull alpine:3.22
  docker run --rm \
    -v /opt:/host-opt \
    -v /root:/host-root \
    alpine:3.22 \
    sh -c 'rm -rf -- /host-opt/mam /host-root/postgres-global'

  echo "Pruning images and networks no longer referenced after MAM removal."
  docker image prune --all --force
  docker network prune --force
}

case "$mode" in
  inventory)
    print_inventory
    print_sync_diagnostics
    ;;
  cleanup)
    if [[ "$confirmation" != "DELETE_UNUSED_SERVER_RESOURCES" ]]; then
      echo "Cleanup confirmation is missing or invalid." >&2
      exit 1
    fi
    verify_production
    remove_portainer
    remove_database_volumes
    echo "Pruning unused Docker build cache."
    docker builder prune --all --force
    echo "Pruning images not referenced by any container."
    docker image prune --all --force
    echo "Pruning unused Docker networks."
    docker network prune --force
    verify_production
    print_inventory
    ;;
  cleanup-mam)
    if [[ "$confirmation" != "DELETE_MAM_AND_DATABASES" ]]; then
      echo "MAM cleanup confirmation is missing or invalid." >&2
      exit 1
    fi
    verify_production
    migrate_snapkit_ingress
    remove_mam_resources
    verify_production
    print_inventory
    ;;
  *)
    echo "Unsupported maintenance mode: $mode" >&2
    exit 1
    ;;
esac
