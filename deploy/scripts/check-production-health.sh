#!/bin/sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/enterprise-system}"
BASE_URL="${LIVE_SITE_URL:-https://www.erpxt.online}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-36}"
MAX_DISK_PERCENT="${MAX_DISK_PERCENT:-85}"
NOW="$(date +%s)"

fail() {
  echo "[production:health] ERROR: $*" >&2
  exit 1
}

for container in enterprise-system-edge-1 enterprise-system-web-1 enterprise-system-api-1 enterprise-system-mysql-1 enterprise-system-redis-1; do
  running="$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)"
  [ "$running" = "true" ] || fail "$container is not running"
done

for container in enterprise-system-web-1 enterprise-system-api-1 enterprise-system-mysql-1; do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")"
  [ "$health" = "healthy" ] || fail "$container health is $health"
done

ready="$(curl -fsS --max-time 5 "$BASE_URL/api/readyz")" || fail "ready endpoint is unavailable"
printf '%s' "$ready" | grep -q '"ready":true' || fail "database readiness check failed"

disk_percent="$(df -P "$PROJECT_DIR" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
[ "$disk_percent" -lt "$MAX_DISK_PERCENT" ] || fail "disk usage is ${disk_percent}%"

latest_mysql="$(find "$BACKUP_DIR/mysql" -type f -name 'enterprise_system_[0-9]*.sql.gz' -print 2>/dev/null | sort | tail -1)"
[ -n "$latest_mysql" ] || fail "no MySQL backup found"
[ -f "$latest_mysql.sha256" ] || fail "missing checksum for $latest_mysql"
(cd "$(dirname "$latest_mysql")" && sha256sum -c "$(basename "$latest_mysql").sha256" >/dev/null) || fail "backup checksum failed"
gzip -dc "$latest_mysql" | grep -q '^CREATE TABLE' || fail "backup has no schema"

backup_mtime="$(stat -c %Y "$latest_mysql")"
backup_age_hours="$(( (NOW - backup_mtime) / 3600 ))"
[ "$backup_age_hours" -le "$MAX_BACKUP_AGE_HOURS" ] || fail "latest backup is ${backup_age_hours}h old"

if systemctl is-active --quiet postfix-mta-sts-resolver.service; then
  fail "disabled CPU-heavy postfix-mta-sts-resolver is active again"
fi

echo "[production:health] OK ready=true disk=${disk_percent}% backup_age=${backup_age_hours}h"
