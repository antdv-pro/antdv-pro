#!/bin/sh
set -eu

: "${AMAP_WEB_SERVICE_KEY:?AMAP_WEB_SERVICE_KEY is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_NAME:?DB_NAME is required}"

MYSQL_CONTAINER="${MYSQL_CONTAINER:-enterprise-system-mysql-1}"
mysql_exec() {
  docker exec -e MYSQL_PWD="$DB_PASSWORD" "$MYSQL_CONTAINER" \
    mysql -N -B -u"$DB_USER" "$DB_NAME" "$@"
}

rows="$(mysql_exec -e "
  SELECT id, longitude, latitude
  FROM gps_location_latest
  WHERE JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.address'))
    REGEXP '^[[:space:]]*-?[0-9]+(\\.[0-9]+)?[[:space:]]*[,，][[:space:]]*-?[0-9]+(\\.[0-9]+)?[[:space:]]*$'
  ORDER BY updated_at DESC;
")"

updated=0
printf '%s\n' "$rows" | while IFS="$(printf '\t')" read -r id longitude latitude; do
  [ -n "$id" ] || continue
  response="$(curl -fsS --get 'https://restapi.amap.com/v3/geocode/regeo' \
    --data-urlencode "key=$AMAP_WEB_SERVICE_KEY" \
    --data-urlencode "location=$longitude,$latitude" \
    --data-urlencode 'extensions=base' \
    --data-urlencode 'output=JSON')"
  address="$(printf '%s' "$response" | jq -r 'select(.status == "1") | .regeocode.formatted_address // empty')"
  [ -n "$address" ] || continue
  encoded="$(printf '%s' "$address" | base64 | tr -d '\n')"
  mysql_exec -e "
    UPDATE gps_location_latest
    SET record_json = JSON_SET(record_json, '$.address', CONVERT(FROM_BASE64('$encoded') USING utf8mb4))
    WHERE id = '$id';
  "
  updated=$((updated + 1))
  printf 'updated %s -> %s\n' "$id" "$address"
done
