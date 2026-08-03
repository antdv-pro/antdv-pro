#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const planPath = process.argv[2] || '/tmp/route_geofence_plan.json'
const outputPath = process.argv[3] || '/tmp/route_geofence_import.sql'
const existingFenceId = process.argv[4] || ''
const plan = JSON.parse(await readFile(planPath, 'utf8'))

function sqlString(value) {
  if (value === null || value === undefined)
    return 'NULL'
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`
}

const generatedAt = new Date().toISOString()
const rows = plan.fences.map((item) => {
  const id = existingFenceId && item.routeCode === 'ROUTE-13YD6XW' && item.routeStage === 'loading'
    ? existingFenceId
    : item.id
  const record = {
    id,
    name: item.name,
    address: item.address,
    shape: item.shape,
    center: item.center,
    radius: item.radius,
    routeCode: item.routeCode,
    routeName: item.routeName,
    routeStage: item.routeStage,
    enabled: item.enabled,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  }
  return {
    id,
    name: item.name,
    shape: item.shape,
    enabled: item.enabled ? 1 : 0,
    record,
  }
})

if (rows.length !== 96)
  throw new Error(`导入行数异常: ${rows.length}`)
if (new Set(rows.map(row => row.id)).size !== rows.length)
  throw new Error('导入 ID 重复')

const values = rows.map(row => `(
  ${sqlString(row.id)},
  CAST(${sqlString(JSON.stringify(row.record))} AS JSON),
  ${sqlString(row.name)},
  ${sqlString(row.shape)},
  ${row.enabled},
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP(),
  NULL
)`).join(',\n')

const sql = `SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO gps_geofence
  (id, record_json, name, shape, enabled, created_at, updated_at, deleted_at)
VALUES
${values}
ON DUPLICATE KEY UPDATE
  record_json = VALUES(record_json),
  name = VALUES(name),
  shape = VALUES(shape),
  enabled = VALUES(enabled),
  updated_at = VALUES(updated_at),
  deleted_at = NULL;

DELETE gv
FROM gps_geofence_vehicle gv
JOIN gps_geofence gf ON gf.id = gv.geofence_id
WHERE gv.id LIKE 'route-auto-bind:%'
  AND JSON_EXTRACT(gf.record_json, '$.routeCode') IS NOT NULL;

INSERT INTO gps_geofence_vehicle
  (id, record_json, geofence_id, vehicle_id, created_at, deleted_at)
SELECT
  CONCAT('route-auto-bind:', SHA1(CONCAT(gf.id, ':', v.vehicle_id))),
  JSON_OBJECT(
    'id', CONCAT('route-auto-bind:', SHA1(CONCAT(gf.id, ':', v.vehicle_id))),
    'geofenceId', gf.id,
    'vehicleId', v.vehicle_id,
    'createdAt', ${sqlString(generatedAt)}
  ),
  gf.id,
  v.vehicle_id,
  UTC_TIMESTAMP(),
  NULL
FROM gps_geofence gf
CROSS JOIN gps_transport_vehicle v
WHERE gf.deleted_at IS NULL
  AND gf.enabled = 1
  AND v.deleted_at IS NULL
  AND JSON_EXTRACT(gf.record_json, '$.routeCode') IS NOT NULL
ON DUPLICATE KEY UPDATE
  record_json = VALUES(record_json),
  deleted_at = NULL;

COMMIT;
`

await writeFile(outputPath, sql)
console.log(JSON.stringify({ outputPath, rowCount: rows.length, bytes: Buffer.byteLength(sql) }))
