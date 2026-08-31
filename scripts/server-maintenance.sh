#!/usr/bin/env bash
set -Eeuo pipefail

mode="${MAINTENANCE_MODE:-inventory}"
confirmation="${MAINTENANCE_CONFIRM:-}"
database_volumes_b64="${DATABASE_VOLUMES_B64:-}"

protected_volumes=(
  snapkit_postgres_prod
  snapkit_media_prod
  snapkit_postgres_dev
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

case "$mode" in
  inventory)
    print_inventory
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
  *)
    echo "Unsupported maintenance mode: $mode" >&2
    exit 1
    ;;
esac
