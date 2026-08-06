SELECT code, ship_date, plate_no, driver_name, route_name,
  JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.customer')) AS json_customer,
  JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.customerName')) AS json_customer_name,
  loading_address, unloading_address
FROM transport_order
WHERE deleted_at IS NULL AND customer_name = ''
ORDER BY ship_date DESC, code
LIMIT 100;

SELECT l.vehicle_id, l.plate_no, l.device_id, l.online_status, l.location_time,
  d.device_no, d.device_name, d.online_status AS device_status,
  b.provider
FROM gps_location_latest l
LEFT JOIN gps_device d ON d.device_id = l.device_id
LEFT JOIN gps_vehicle_device_bind b ON b.vehicle_id = l.vehicle_id
WHERE l.deleted_at IS NULL AND l.location_time < NOW() - INTERVAL 24 HOUR
ORDER BY l.location_time;

SELECT r.code, r.name, r.status, COUNT(rm.menu_id) AS menu_count,
  SUM(u.id IS NOT NULL) AS assigned_users
FROM sys_role r
LEFT JOIN sys_role_menu rm ON rm.role_id = r.id
LEFT JOIN sys_user_role ur ON ur.role_id = r.id
LEFT JOIN sys_user u ON u.id = ur.user_id
GROUP BY r.id, r.code, r.name, r.status
ORDER BY r.id;
