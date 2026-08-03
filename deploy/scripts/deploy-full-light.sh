#!/bin/sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/enterprise-system}"
WEB_CONTAINER="${WEB_CONTAINER:-enterprise-system-web-1}"
API_CONTAINER="${API_CONTAINER:-enterprise-system-api-1}"
READY_URL="${READY_URL:-https://www.erpxt.online/api/readyz}"
SITE_URL="${SITE_URL:-https://www.erpxt.online/}"
LOCK_DIR="${DEPLOY_LOCK_DIR:-/tmp/enterprise-system-deploy.lock}"
ROLLBACK_DIR="$(mktemp -d)"
DEPLOYED=false

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[deploy:full] another deployment is already running: $LOCK_DIR" >&2
  exit 2
fi

cleanup() {
  rm -rf "$ROLLBACK_DIR"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

clear_container_dir() {
  container="$1"
  directory="$2"
  docker exec "$container" sh -c "find '$directory' -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
}

rollback() {
  echo "[deploy:full] validation failed; restoring Web and API files" >&2
  clear_container_dir "$WEB_CONTAINER" /usr/share/nginx/html || true
  docker cp "$ROLLBACK_DIR/web/." "$WEB_CONTAINER:/usr/share/nginx/html/" >/dev/null || true
  clear_container_dir "$API_CONTAINER" /app/dist/servers || true
  docker cp "$ROLLBACK_DIR/api/." "$API_CONTAINER:/app/dist/servers/" >/dev/null || true
  if [ -f "$ROLLBACK_DIR/package.json" ]; then
    docker cp "$ROLLBACK_DIR/package.json" "$API_CONTAINER:/app/package.json" >/dev/null || true
  fi
  docker restart "$API_CONTAINER" "$WEB_CONTAINER" >/dev/null || true
  cleanup
  exit 1
}

trap cleanup EXIT
trap rollback HUP INT TERM

cd "$PROJECT_DIR"
[ -f dist/index.html ] || { echo "dist/index.html is missing" >&2; exit 1; }
[ -f dist/servers/app.js ] || { echo "dist/servers/app.js is missing" >&2; exit 1; }
docker inspect "$WEB_CONTAINER" "$API_CONTAINER" >/dev/null

mkdir -p "$ROLLBACK_DIR/web" "$ROLLBACK_DIR/api"
docker cp "$WEB_CONTAINER:/usr/share/nginx/html/." "$ROLLBACK_DIR/web/" >/dev/null
docker cp "$API_CONTAINER:/app/dist/servers/." "$ROLLBACK_DIR/api/" >/dev/null
docker cp "$API_CONTAINER:/app/package.json" "$ROLLBACK_DIR/package.json" >/dev/null

clear_container_dir "$WEB_CONTAINER" /usr/share/nginx/html
docker cp dist/. "$WEB_CONTAINER:/usr/share/nginx/html/" >/dev/null || rollback
clear_container_dir "$API_CONTAINER" /app/dist/servers
docker cp dist/servers/. "$API_CONTAINER:/app/dist/servers/" >/dev/null || rollback
docker cp dist/package.json "$API_CONTAINER:/app/package.json" >/dev/null || rollback
docker restart "$API_CONTAINER" "$WEB_CONTAINER" >/dev/null || rollback

for container in "$API_CONTAINER" "$WEB_CONTAINER"; do
  healthy=false
  for _ in $(seq 1 30); do
    if [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)" = "healthy" ]; then
      healthy=true
      break
    fi
    sleep 2
  done
  [ "$healthy" = true ] || rollback
done

ready="$(curl -fsS --max-time 8 "$READY_URL")" || rollback
printf '%s' "$ready" | grep -q '"ready":true' || rollback
curl -fsS --max-time 8 "$SITE_URL" | grep -q '<div id="app"></div>' || rollback

web_image="$(docker inspect -f '{{.Config.Image}}' "$WEB_CONTAINER")"
api_image="$(docker inspect -f '{{.Config.Image}}' "$API_CONTAINER")"
docker commit "$WEB_CONTAINER" "$web_image" >/dev/null || rollback
docker commit "$API_CONTAINER" "$api_image" >/dev/null || rollback

DEPLOYED=true
trap - EXIT HUP INT TERM
cleanup
echo "[deploy:full] deployed Web=$web_image API=$api_image"
