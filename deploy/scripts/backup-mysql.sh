#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups/mysql}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-enterprise_system}"
DB_USER="${DB_USER:-enterprise_app}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FINAL_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"
TEMP_FILE="$FINAL_FILE.tmp"

mkdir -p "$BACKUP_DIR"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "DB_PASSWORD is required" >&2
  exit 1
fi

trap 'rm -f "$TEMP_FILE" "$TEMP_FILE.sql"' EXIT HUP INT TERM

mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  --result-file="$TEMP_FILE.sql" \
  "$DB_NAME"

gzip -c "$TEMP_FILE.sql" > "$TEMP_FILE"
rm -f "$TEMP_FILE.sql"
gzip -t "$TEMP_FILE"
test -s "$TEMP_FILE"
gzip -dc "$TEMP_FILE" | grep -q '^-- MySQL dump'
gzip -dc "$TEMP_FILE" | grep -q '^CREATE TABLE'
mv "$TEMP_FILE" "$FINAL_FILE"
sha256sum "$FINAL_FILE" > "$FINAL_FILE.sha256"

find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name "*.sql.gz.sha256" -mtime +"$RETENTION_DAYS" -delete
trap - EXIT HUP INT TERM
echo "MySQL backup created and verified: $FINAL_FILE"
