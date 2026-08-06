#!/bin/sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/enterprise-system}"
CONTAINER="${API_CONTAINER:-enterprise-system-api-1}"
IMAGE="${API_IMAGE:-enterprise-system-api:latest}"
READY_URL="${READY_URL:-https://www.erpxt.online/api/readyz}"
LOCK_DIR="${DEPLOY_LOCK_DIR:-/tmp/enterprise-system-deploy.lock}"
ROLLBACK_DIR="$(mktemp -d)"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[deploy:api] another deployment is already running: $LOCK_DIR" >&2
  exit 2
fi

cleanup() {
  rm -rf "$ROLLBACK_DIR"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

rollback() {
  echo "[deploy:api] validation failed; restoring previous API files" >&2
  if [ -d "$ROLLBACK_DIR/servers" ]; then
    docker cp "$ROLLBACK_DIR/servers/." "$CONTAINER:/app/dist/servers/" >/dev/null
    docker restart "$CONTAINER" >/dev/null
  fi
  cleanup
  exit 1
}

trap cleanup EXIT
trap rollback HUP INT TERM
cd "$PROJECT_DIR"
[ -f dist/servers/app.js ] || { echo "dist/servers/app.js is missing" >&2; exit 1; }
docker inspect "$CONTAINER" >/dev/null
docker cp "$CONTAINER:/app/dist/servers" "$ROLLBACK_DIR" >/dev/null
docker cp dist/servers/. "$CONTAINER:/app/dist/servers/" >/dev/null || rollback
docker restart "$CONTAINER" >/dev/null || rollback

healthy=false
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$CONTAINER" 2>/dev/null || true)" = "healthy" ]; then
    healthy=true
    break
  fi
  sleep 2
done
[ "$healthy" = true ] || rollback

ready="$(curl -fsS --max-time 5 "$READY_URL")" || rollback
printf '%s' "$ready" | grep -q '"ready":true' || rollback
docker commit "$CONTAINER" "$IMAGE" >/dev/null || rollback

trap - EXIT HUP INT TERM
cleanup
echo "[deploy:api] deployed and committed: $IMAGE"
