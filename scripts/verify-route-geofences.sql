SET NAMES utf8mb4;

WITH routes AS (
  SELECT code AS route_code
  FROM transport_base_data
  WHERE category = 'route'
), fences AS (
  SELECT
    JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.routeCode')) AS route_code,
    JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.routeStage')) AS route_stage
  FROM gps_geofence
  WHERE deleted_at IS NULL
    AND JSON_EXTRACT(record_json, '$.routeCode') IS NOT NULL
)
SELECT
  (SELECT COUNT(*) FROM routes) AS route_count,
  (SELECT COUNT(*) FROM fences) AS fence_count,
  (SELECT COUNT(*) FROM fences WHERE route_stage = 'loading') AS loading_count,
  (SELECT COUNT(*) FROM fences WHERE route_stage = 'unloading') AS unloading_count,
  (SELECT COUNT(*) FROM routes r LEFT JOIN fences f ON f.route_code = r.route_code AND f.route_stage = 'loading' WHERE f.route_code IS NULL) AS missing_loading,
  (SELECT COUNT(*) FROM routes r LEFT JOIN fences f ON f.route_code = r.route_code AND f.route_stage = 'unloading' WHERE f.route_code IS NULL) AS missing_unloading,
  (SELECT COUNT(*) FROM fences f LEFT JOIN routes r ON r.route_code = f.route_code WHERE r.route_code IS NULL) AS orphan_fences;

SELECT COUNT(*) AS duplicate_route_stages
FROM (
  SELECT
    JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.routeCode')) AS route_code,
    JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.routeStage')) AS route_stage,
    COUNT(*) AS row_count
  FROM gps_geofence
  WHERE deleted_at IS NULL
    AND JSON_EXTRACT(record_json, '$.routeCode') IS NOT NULL
  GROUP BY route_code, route_stage
  HAVING row_count <> 1
) duplicates;

SELECT COUNT(*) AS invalid_fences
FROM gps_geofence
WHERE deleted_at IS NULL
  AND JSON_EXTRACT(record_json, '$.routeCode') IS NOT NULL
  AND (
    shape <> 'circle'
    OR enabled <> 1
    OR CAST(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.radius')) AS UNSIGNED) <> 1000
    OR CAST(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.center[0]')) AS DECIMAL(12, 6)) NOT BETWEEN -180 AND 180
    OR CAST(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.center[1]')) AS DECIMAL(12, 6)) NOT BETWEEN -90 AND 90
    OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.name')), '') = ''
    OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.address')), '') = ''
    OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.routeName')), '') = ''
  );

SELECT COUNT(DISTINCT CONCAT(
  JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.center[0]')),
  ',',
  JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.center[1]'))
)) AS unique_coordinate_centers
FROM gps_geofence
WHERE deleted_at IS NULL
  AND JSON_EXTRACT(record_json, '$.routeCode') IS NOT NULL;

SELECT
  COUNT(DISTINCT gf.id) AS route_fences_with_vehicles,
  COUNT(DISTINCT gv.vehicle_id) AS bound_vehicles,
  COUNT(*) AS route_vehicle_bindings
FROM gps_geofence gf
JOIN gps_geofence_vehicle gv ON gv.geofence_id = gf.id AND gv.deleted_at IS NULL
WHERE gf.deleted_at IS NULL
  AND JSON_EXTRACT(gf.record_json, '$.routeCode') IS NOT NULL;
