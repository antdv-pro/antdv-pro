SELECT 'counts' AS audit,
  (SELECT COUNT(*) FROM transport_order) AS orders,
  (SELECT COUNT(*) FROM transport_fuel_record) AS fuel,
  (SELECT COUNT(*) FROM transport_etc_record) AS etc_records,
  (SELECT COUNT(*) FROM transport_maintenance_order) AS maintenance,
  (SELECT COUNT(*) FROM regulatory_fee) AS fees,
  (SELECT COUNT(*) FROM transport_base_data) AS base_data,
  (SELECT COUNT(*) FROM gps_transport_vehicle) AS gps_vehicles,
  (SELECT COUNT(*) FROM gps_location_latest) AS gps_locations,
  (SELECT COUNT(*) FROM gps_alarm) AS gps_alarms,
  (SELECT COUNT(*) FROM sys_user) AS users;

SELECT 'order_quality' AS audit,
  COUNT(*) AS active_rows,
  SUM(code = '') AS missing_code,
  SUM(plate_no = '') AS missing_plate,
  SUM(customer_name = '') AS missing_customer,
  SUM(freight_total < 0) AS negative_freight,
  SUM(financial_year NOT BETWEEN 2000 AND 2100) AS bad_year,
  SUM(financial_month NOT BETWEEN 1 AND 12) AS bad_month
FROM transport_order WHERE deleted_at IS NULL;

SELECT 'order_duplicate_codes' AS audit, COUNT(*) AS duplicate_groups
FROM (SELECT code FROM transport_order WHERE deleted_at IS NULL GROUP BY code HAVING COUNT(*) > 1) duplicates;

SELECT 'fuel_quality' AS audit,
  COUNT(*) AS active_rows,
  SUM(code = '') AS missing_code,
  SUM(plate_no = '') AS missing_plate,
  SUM(quantity < 0) AS negative_quantity,
  SUM(amount < 0) AS negative_amount,
  SUM(financial_month NOT BETWEEN 1 AND 12) AS bad_month
FROM transport_fuel_record WHERE deleted_at IS NULL;

SELECT 'etc_quality' AS audit,
  COUNT(*) AS active_rows,
  SUM(code = '') AS missing_code,
  SUM(plate_no = '') AS missing_plate,
  SUM(amount < 0) AS negative_amount,
  SUM(financial_month NOT BETWEEN 1 AND 12) AS bad_month
FROM transport_etc_record WHERE deleted_at IS NULL;

SELECT 'maintenance_quality' AS audit,
  COUNT(*) AS active_rows,
  SUM(code = '') AS missing_code,
  SUM(plate_no = '') AS missing_plate,
  SUM(project = '') AS missing_project,
  SUM(amount < 0) AS negative_amount,
  SUM(financial_month NOT BETWEEN 1 AND 12) AS bad_month
FROM transport_maintenance_order WHERE deleted_at IS NULL;

SELECT 'fee_quality' AS audit,
  COUNT(*) AS active_rows,
  SUM(fee_name = '') AS missing_name,
  SUM(total_amount < 0) AS negative_amount,
  SUM(valid_end_date < valid_start_date) AS reversed_dates,
  SUM(valid_months <= 0) AS bad_valid_months
FROM regulatory_fee WHERE deleted_at IS NULL;

SELECT 'gps_relations' AS audit,
  (SELECT COUNT(*) FROM gps_transport_vehicle v LEFT JOIN gps_location_latest l ON l.vehicle_id = v.vehicle_id WHERE v.deleted_at IS NULL AND l.vehicle_id IS NULL) AS vehicles_without_location,
  (SELECT COUNT(*) FROM gps_location_latest l LEFT JOIN gps_transport_vehicle v ON v.vehicle_id = l.vehicle_id WHERE l.deleted_at IS NULL AND v.vehicle_id IS NULL) AS orphan_locations,
  (SELECT COUNT(*) FROM gps_vehicle_device_bind b LEFT JOIN gps_device d ON d.device_id = b.device_id WHERE b.deleted_at IS NULL AND d.device_id IS NULL) AS orphan_device_bindings,
  (SELECT COUNT(*) FROM gps_geofence_vehicle gv LEFT JOIN gps_geofence g ON g.id = gv.geofence_id WHERE gv.deleted_at IS NULL AND g.id IS NULL) AS orphan_geofence_bindings;

SELECT 'gps_quality' AS audit,
  COUNT(*) AS active_locations,
  SUM(latitude NOT BETWEEN -90 AND 90) AS invalid_latitude,
  SUM(longitude NOT BETWEEN -180 AND 180) AS invalid_longitude,
  SUM(speed < 0) AS negative_speed,
  SUM(location_time IS NULL) AS missing_time,
  SUM(location_time < NOW() - INTERVAL 24 HOUR) AS stale_over_24h,
  MIN(location_time) AS oldest_location,
  MAX(location_time) AS newest_location
FROM gps_location_latest WHERE deleted_at IS NULL;

SELECT 'system_relations' AS audit,
  (SELECT COUNT(*) FROM sys_user u LEFT JOIN sys_user_role ur ON ur.user_id = u.id WHERE ur.user_id IS NULL) AS users_without_role,
  (SELECT COUNT(*) FROM sys_role r LEFT JOIN sys_role_menu rm ON rm.role_id = r.id WHERE rm.role_id IS NULL) AS roles_without_menu,
  (SELECT COUNT(*) FROM sys_department d LEFT JOIN sys_company c ON c.id = d.company_id WHERE c.id IS NULL) AS departments_without_company;
