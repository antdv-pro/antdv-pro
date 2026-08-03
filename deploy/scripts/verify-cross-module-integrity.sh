#!/bin/sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/enterprise-system}"
API_CONTAINER="${API_CONTAINER:-enterprise-system-api-1}"
TARGET_ROOT="/app/.integrity-check"
BUNDLED_VERIFIER="/app/verify-cross-module-integrity.bundle.cjs"

cd "$PROJECT_DIR"
docker inspect "$API_CONTAINER" >/dev/null

if docker exec "$API_CONTAINER" test -f "$BUNDLED_VERIFIER"; then
  docker exec -w /app "$API_CONTAINER" node "$BUNDLED_VERIFIER"
  exit 0
fi

test -f scripts/verify-cross-module-integrity.mjs
test -f shared/business-overview.ts

docker exec "$API_CONTAINER" mkdir -p "$TARGET_ROOT/scripts" "$TARGET_ROOT/shared"
docker cp scripts/verify-cross-module-integrity.mjs "$API_CONTAINER:$TARGET_ROOT/scripts/verify-cross-module-integrity.mjs" >/dev/null
docker cp shared/business-overview.ts "$API_CONTAINER:$TARGET_ROOT/shared/business-overview.ts" >/dev/null
docker exec -w /app "$API_CONTAINER" node "$TARGET_ROOT/scripts/verify-cross-module-integrity.mjs"
