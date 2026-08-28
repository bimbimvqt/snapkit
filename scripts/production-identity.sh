#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

mode="${1:-prepare}"
target_project="snapkit-prod"
target_volume="snapkit_postgres_prod"
state_file="$project_dir/.previous-compose-identity"

env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' .env.prod
}

validate_identifier() {
  local value="$1"
  local label="$2"
  if [[ ! "$value" =~ ^[a-z_][a-z0-9_]*$ ]]; then
    echo "$label must be a safe lowercase PostgreSQL identifier." >&2
    exit 1
  fi
}

find_previous_postgres() {
  local container_id working_dir project_name mounted_volume
  for container_id in $(docker ps -aq --filter label=com.docker.compose.service=postgres); do
    working_dir="$(docker inspect "$container_id" --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')"
    project_name="$(docker inspect "$container_id" --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
    mounted_volume="$(docker inspect "$container_id" --format '{{ range .Mounts }}{{ if eq .Destination "/var/lib/postgresql/data" }}{{ .Name }}{{ end }}{{ end }}')"
    if [[ "$working_dir" == "$project_dir" && "$project_name" != "$target_project" && "$mounted_volume" != "$target_volume" && "$mounted_volume" != "snapkit_postgres_dev" ]]; then
      printf '%s\n' "$container_id"
      return 0
    fi
  done
  return 1
}

volume_is_initialized() {
  docker volume inspect "$target_volume" >/dev/null 2>&1 || return 1
  docker run --rm -v "$target_volume:/data:ro" postgres:17-alpine sh -c 'test -s /data/PG_VERSION && test -d /data/base'
}

prepare() {
  if volume_is_initialized; then
    echo "Production volume $target_volume is already initialized."
    return
  fi

  local previous_postgres
  if ! previous_postgres="$(find_previous_postgres)"; then
    docker volume create "$target_volume" >/dev/null
    echo "Created empty production volume $target_volume for a fresh installation."
    return
  fi

  local previous_project previous_volume postgres_image current_db current_user current_email
  local desired_db desired_user desired_password desired_email backup_path temporary_postgres
  previous_project="$(docker inspect "$previous_postgres" --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
  previous_volume="$(docker inspect "$previous_postgres" --format '{{ range .Mounts }}{{ if eq .Destination "/var/lib/postgresql/data" }}{{ .Name }}{{ end }}{{ end }}')"
  postgres_image="$(docker inspect "$previous_postgres" --format '{{ .Config.Image }}')"
  current_db="$(docker inspect "$previous_postgres" --format '{{ range .Config.Env }}{{ println . }}{{ end }}' | awk -F= '$1 == "POSTGRES_DB" {print substr($0, index($0, "=") + 1); exit}')"
  current_user="$(docker inspect "$previous_postgres" --format '{{ range .Config.Env }}{{ println . }}{{ end }}' | awk -F= '$1 == "POSTGRES_USER" {print substr($0, index($0, "=") + 1); exit}')"
  current_email="$(docker inspect "$previous_postgres" --format '{{ range .Config.Env }}{{ println . }}{{ end }}' | awk -F= '$1 == "ADMIN_EMAIL" {print substr($0, index($0, "=") + 1); exit}')"
  desired_db="$(env_value POSTGRES_DB)"
  desired_user="$(env_value POSTGRES_USER)"
  desired_password="$(env_value POSTGRES_PASSWORD)"
  desired_email="$(env_value ADMIN_EMAIL)"
  validate_identifier "$current_db" "Current POSTGRES_DB"
  validate_identifier "$current_user" "Current POSTGRES_USER"
  validate_identifier "$desired_db" "POSTGRES_DB"
  validate_identifier "$desired_user" "POSTGRES_USER"
  [[ -n "$previous_volume" && -n "$desired_password" && -n "$desired_email" ]]

  docker start "$previous_postgres" >/dev/null
  for attempt in $(seq 1 30); do
    if docker exec "$previous_postgres" pg_isready -U "$current_user" -d "$current_db" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker exec "$previous_postgres" pg_isready -U "$current_user" -d "$current_db" >/dev/null

  umask 077
  mkdir -p backups
  backup_path="backups/snapkit-preidentity-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
  docker exec "$previous_postgres" sh -c 'pg_dump --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -9 > "$backup_path"
  [[ -s "$backup_path" ]]

  local previous_container_ids
  previous_container_ids="$(docker ps -aq --filter label=com.docker.compose.project="$previous_project")"
  rollback_previous() {
    local exit_code=$?
    trap - ERR
    if [[ -n "$previous_container_ids" ]]; then
      docker start $previous_container_ids >/dev/null 2>&1 || true
    fi
    exit "$exit_code"
  }
  trap rollback_previous ERR
  if [[ -n "$previous_container_ids" ]]; then
    docker stop $previous_container_ids >/dev/null
  fi

  if docker volume inspect "$target_volume" >/dev/null 2>&1; then
    docker volume rm "$target_volume" >/dev/null
  fi
  docker volume create "$target_volume" >/dev/null
  docker run --rm -v "$previous_volume:/source:ro" -v "$target_volume:/target" "$postgres_image" sh -c 'cd /source && tar cf - . | tar xpf - -C /target'

  temporary_postgres="snapkit-identity-migrator-$RANDOM"
  docker run -d --name "$temporary_postgres" -v "$target_volume:/var/lib/postgresql/data" "$postgres_image" >/dev/null
  cleanup_temporary() {
    docker container rm --force "$temporary_postgres" >/dev/null 2>&1 || true
  }
  trap 'cleanup_temporary; rollback_previous' ERR
  for attempt in $(seq 1 30); do
    if docker exec "$temporary_postgres" pg_isready -U "$current_user" -d "$current_db" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker exec "$temporary_postgres" pg_isready -U "$current_user" -d "$current_db" >/dev/null

  if [[ -n "$current_email" && "$current_email" != "$desired_email" ]]; then
    docker exec -i "$temporary_postgres" psql -v ON_ERROR_STOP=1 -U "$current_user" -d "$current_db" \
      -v current_email="$current_email" -v desired_email="$desired_email" <<'SQL'
UPDATE "User"
SET email = :'desired_email', name = 'Snapkit Admin'
WHERE email = :'current_email' AND role = 'ADMIN';
SQL
  fi

  if [[ "$current_db" != "$desired_db" ]]; then
    docker exec -i "$temporary_postgres" psql -v ON_ERROR_STOP=1 -U "$current_user" -d postgres \
      -v current_db="$current_db" -v desired_db="$desired_db" <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'current_db' AND pid <> pg_backend_pid();
SELECT format('ALTER DATABASE %I RENAME TO %I', :'current_db', :'desired_db') \gexec
SQL
  fi

  if [[ "$current_user" != "$desired_user" ]]; then
    docker exec "$temporary_postgres" psql -v ON_ERROR_STOP=1 -U "$current_user" -d postgres \
      -c 'CREATE ROLE snapkit_identity_migrator WITH LOGIN SUPERUSER;'
    docker exec -i "$temporary_postgres" psql -v ON_ERROR_STOP=1 -U snapkit_identity_migrator -d postgres \
      -v current_user="$current_user" -v desired_user="$desired_user" <<'SQL'
SELECT format('ALTER ROLE %I RENAME TO %I', :'current_user', :'desired_user') \gexec
SQL
    docker exec "$temporary_postgres" psql -v ON_ERROR_STOP=1 -U "$desired_user" -d postgres \
      -c 'DROP ROLE snapkit_identity_migrator;'
  fi

  docker exec -i "$temporary_postgres" psql -v ON_ERROR_STOP=1 -U "$desired_user" -d postgres \
    -v desired_user="$desired_user" -v desired_password="$desired_password" <<'SQL'
SELECT format('ALTER ROLE %I WITH PASSWORD %L', :'desired_user', :'desired_password') \gexec
SQL

  cleanup_temporary
  trap - ERR
  printf 'PREVIOUS_PROJECT=%s\nPREVIOUS_VOLUME=%s\n' "$previous_project" "$previous_volume" > "$state_file"
  chmod 600 "$state_file"
  echo "Prepared $target_volume from the previous stack. Backup: $backup_path"
}

cleanup() {
  if [[ ! -f "$state_file" ]]; then
    echo "No previous production Compose identity remains to clean up."
    return 0
  fi
  local previous_project previous_volume container_ids network_ids image_refs
  previous_project="$(awk -F= '$1 == "PREVIOUS_PROJECT" {print substr($0, index($0, "=") + 1)}' "$state_file")"
  previous_volume="$(awk -F= '$1 == "PREVIOUS_VOLUME" {print substr($0, index($0, "=") + 1)}' "$state_file")"
  [[ -n "$previous_project" && "$previous_project" != "$target_project" && -n "$previous_volume" && "$previous_volume" != "$target_volume" ]]
  container_ids="$(docker ps -aq --filter label=com.docker.compose.project="$previous_project")"
  image_refs=""
  if [[ -n "$container_ids" ]]; then
    image_refs="$(docker inspect $container_ids --format '{{ .Config.Image }}' | sort -u)"
    docker container rm --force $container_ids >/dev/null
  fi
  network_ids="$(docker network ls -q --filter label=com.docker.compose.project="$previous_project")"
  if [[ -n "$network_ids" ]]; then
    docker network rm $network_ids >/dev/null
  fi
  docker volume rm "$previous_volume" >/dev/null
  if [[ -n "$image_refs" ]]; then
    docker image rm $image_refs >/dev/null 2>&1 || true
  fi
  rm -f "$state_file"
  echo "Removed the previous production Compose identity after successful verification."
}

case "$mode" in
  prepare) prepare ;;
  cleanup) cleanup ;;
  *) echo "Usage: bash scripts/production-identity.sh <prepare|cleanup>" >&2; exit 1 ;;
esac
