#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/enterprise-system}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-enterprise-system-mysql-1}"
APPLY="${APPLY:-false}"

cd "$PROJECT_DIR"
set -a
. ./.env.production
set +a

[ -n "${AMAP_WEB_SERVICE_KEY:-}" ] || { echo "AMAP_WEB_SERVICE_KEY is required" >&2; exit 1; }
command -v jq >/dev/null

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
route_file="$work_dir/routes.txt"
cache_dir="$work_dir/cache"
sql_file="$work_dir/update.sql"
mkdir -p "$cache_dir"

mysql_exec() {
  docker exec -i "$MYSQL_CONTAINER" sh -c 'exec mysql --default-character-set=utf8mb4 -N -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
}

mysql_exec > "$route_file" <<'SQL'
SELECT CONCAT_WS('|',
  id,
  TO_BASE64(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.loadingAddress')), '')),
  TO_BASE64(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.unloadingAddress')), '')),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.loadingLongitude')), ''),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.loadingLatitude')), ''),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.unloadingLongitude')), ''),
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.unloadingLatitude')), '')
)
FROM transport_base_data
WHERE category='route'
ORDER BY id;
SQL

geocode() {
  local encoded="$1" address hash result status level longitude latitude precise
  address="$(printf '%s' "$encoded" | base64 -d)"
  [ -n "$address" ] || { printf 'empty||||'; return; }
  hash="$(printf '%s' "$address" | sha256sum | awk '{print $1}')"
  if [ -f "$cache_dir/$hash" ]; then
    cat "$cache_dir/$hash"
    return
  fi
  result="$(curl -fsS --retry 2 --max-time 12 --get \
    --data-urlencode "address=$address" \
    --data-urlencode 'output=JSON' \
    --data-urlencode "key=$AMAP_WEB_SERVICE_KEY" \
    https://restapi.amap.com/v3/geocode/geo || true)"
  status="$(printf '%s' "$result" | jq -r '.status // "0"' 2>/dev/null || printf '0')"
  level="$(printf '%s' "$result" | jq -r '.geocodes[0].level // ""' 2>/dev/null || true)"
  longitude="$(printf '%s' "$result" | jq -r '.geocodes[0].location // ""' 2>/dev/null | cut -d, -f1)"
  latitude="$(printf '%s' "$result" | jq -r '.geocodes[0].location // ""' 2>/dev/null | cut -d, -f2)"
  precise=true
  case "$level" in ''|'国家'|'省'|'市'|'区县'|'乡镇') precise=false ;; esac
  if [ "$status" != 1 ] || [ -z "$longitude" ] || [ -z "$latitude" ]; then
    printf 'miss||||' > "$cache_dir/$hash"
  elif [ "$precise" = true ]; then
    printf 'precise|%s|%s|%s|' "$longitude" "$latitude" "$level" > "$cache_dir/$hash"
  else
    printf 'approximate|%s|%s|%s|' "$longitude" "$latitude" "$level" > "$cache_dir/$hash"
  fi
  cat "$cache_dir/$hash"
  sleep 0.12
}

printf '%s\n' 'START TRANSACTION;' > "$sql_file"
routes=0
updated_routes=0
precise_points=0
approximate_points=0
missed_points=0

while IFS='|' read -r id loading_address unloading_address loading_lng loading_lat unloading_lng unloading_lat; do
  routes=$((routes + 1))
  assignments=()
  for stage in loading unloading; do
    if [ "$stage" = loading ]; then
      encoded="$loading_address"; longitude="$loading_lng"; latitude="$loading_lat"
    else
      encoded="$unloading_address"; longitude="$unloading_lng"; latitude="$unloading_lat"
    fi
    [ -z "$longitude" ] || [ -z "$latitude" ] || continue
    result="$(geocode "$encoded")"
    IFS='|' read -r kind resolved_lng resolved_lat level _ <<< "$result"
    case "$kind" in
      precise)
        precise_points=$((precise_points + 1))
        assignments+=("'$.${stage}Longitude', '$resolved_lng', '$.${stage}Latitude', '$resolved_lat'")
        ;;
      approximate) approximate_points=$((approximate_points + 1)) ;;
      miss|empty) missed_points=$((missed_points + 1)) ;;
    esac
  done
  if [ "${#assignments[@]}" -gt 0 ]; then
    updated_routes=$((updated_routes + 1))
    joined="$(IFS=,; echo "${assignments[*]}")"
    printf "UPDATE transport_base_data SET record_json=JSON_SET(record_json, %s), updated_at=NOW() WHERE id='%s' AND category='route';\n" "$joined" "$id" >> "$sql_file"
  fi
done < "$route_file"

printf '%s\n' 'COMMIT;' >> "$sql_file"
printf 'routes=%s updated_routes=%s precise_points=%s approximate_points=%s missed_points=%s unique_queries=%s apply=%s\n' \
  "$routes" "$updated_routes" "$precise_points" "$approximate_points" "$missed_points" "$(find "$cache_dir" -type f | wc -l)" "$APPLY"

if [ "$APPLY" = true ]; then
  mysql_exec < "$sql_file"
  echo 'AMap route coordinate backfill committed.'
else
  echo 'Dry run only; no database rows changed.'
fi
