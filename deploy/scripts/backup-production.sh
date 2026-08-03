#!/bin/sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/enterprise-system}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-enterprise-system-mysql-1}"
API_CONTAINER="${API_CONTAINER:-enterprise-system-api-1}"
STAMP="$(date +%Y%m%d_%H%M%S)"
MYSQL_FINAL="$BACKUP_DIR/mysql/enterprise_system_${STAMP}.sql.gz"
UPLOAD_FINAL="$BACKUP_DIR/uploads/uploads_${STAMP}.tar.gz"

mkdir -p "$BACKUP_DIR/mysql" "$BACKUP_DIR/uploads"
trap 'rm -f "$MYSQL_FINAL.tmp" "$UPLOAD_FINAL.tmp"' EXIT HUP INT TERM

docker inspect "$MYSQL_CONTAINER" "$API_CONTAINER" >/dev/null

docker exec "$MYSQL_CONTAINER" sh -c '
  set -eu
  rm -f /tmp/enterprise-system-backup.sql /tmp/enterprise-system-backup.sql.gz
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --routines --triggers --default-character-set=utf8mb4 \
    --result-file=/tmp/enterprise-system-backup.sql "$MYSQL_DATABASE"
  gzip /tmp/enterprise-system-backup.sql
  gzip -t /tmp/enterprise-system-backup.sql.gz
'
docker cp "$MYSQL_CONTAINER:/tmp/enterprise-system-backup.sql.gz" "$MYSQL_FINAL.tmp" >/dev/null
gzip -t "$MYSQL_FINAL.tmp"
test -s "$MYSQL_FINAL.tmp"
gzip -dc "$MYSQL_FINAL.tmp" | grep -q '^-- MySQL dump'
gzip -dc "$MYSQL_FINAL.tmp" | grep -q '^CREATE TABLE'
mv "$MYSQL_FINAL.tmp" "$MYSQL_FINAL"
sha256sum "$MYSQL_FINAL" > "$MYSQL_FINAL.sha256"

docker exec "$API_CONTAINER" sh -c '
  set -eu
  rm -f /tmp/enterprise-system-uploads.tar.gz
  tar -czf /tmp/enterprise-system-uploads.tar.gz -C /app/uploads .
  tar -tzf /tmp/enterprise-system-uploads.tar.gz >/dev/null
'
docker cp "$API_CONTAINER:/tmp/enterprise-system-uploads.tar.gz" "$UPLOAD_FINAL.tmp" >/dev/null
tar -tzf "$UPLOAD_FINAL.tmp" >/dev/null
test -s "$UPLOAD_FINAL.tmp"
mv "$UPLOAD_FINAL.tmp" "$UPLOAD_FINAL"
sha256sum "$UPLOAD_FINAL" > "$UPLOAD_FINAL.sha256"

find "$BACKUP_DIR/mysql" -type f \( -name '*.sql.gz' -o -name '*.sql.gz.sha256' \) -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR/uploads" -type f \( -name 'uploads_*.tar.gz' -o -name 'uploads_*.tar.gz.sha256' \) -mtime +"$RETENTION_DAYS" -delete

trap - EXIT HUP INT TERM
echo "Production backup verified: $MYSQL_FINAL"
echo "Production backup verified: $UPLOAD_FINAL"
