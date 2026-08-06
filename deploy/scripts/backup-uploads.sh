#!/bin/sh
set -eu

UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
BACKUP_DIR="${BACKUP_DIR:-./backups/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FINAL_FILE="$BACKUP_DIR/uploads_${STAMP}.tar.gz"
TEMP_FILE="$FINAL_FILE.tmp"

mkdir -p "$BACKUP_DIR"

if [ ! -d "$UPLOAD_DIR" ]; then
  echo "Upload directory does not exist: $UPLOAD_DIR" >&2
  exit 1
fi

trap 'rm -f "$TEMP_FILE"' EXIT HUP INT TERM
tar -czf "$TEMP_FILE" -C "$UPLOAD_DIR" .
tar -tzf "$TEMP_FILE" >/dev/null
test -s "$TEMP_FILE"
mv "$TEMP_FILE" "$FINAL_FILE"
sha256sum "$FINAL_FILE" > "$FINAL_FILE.sha256"
find "$BACKUP_DIR" -type f -name "uploads_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name "uploads_*.tar.gz.sha256" -mtime +"$RETENTION_DAYS" -delete
trap - EXIT HUP INT TERM
echo "Upload backup created and verified: $FINAL_FILE"
