USE enterprise_system;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transport_maintenance_order' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE transport_maintenance_order ADD COLUMN created_by VARCHAR(64) NULL AFTER remark',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_vehicle' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE office_vehicle ADD COLUMN created_by VARCHAR(64) NULL AFTER remark',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_vehicle_expense' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE office_vehicle_expense ADD COLUMN created_by VARCHAR(64) NULL AFTER remark',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_vehicle_license' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE office_vehicle_license ADD COLUMN created_by VARCHAR(64) NULL AFTER remark',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_vehicle_insurance' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE office_vehicle_insurance ADD COLUMN created_by VARCHAR(64) NULL AFTER remark',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_vehicle_reminder' AND COLUMN_NAME = 'created_by') = 0,
  'ALTER TABLE office_vehicle_reminder ADD COLUMN created_by VARCHAR(64) NULL AFTER source_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE transport_maintenance_order
SET created_by = COALESCE(created_by, JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.createdBy')))
WHERE created_by IS NULL AND record_json IS NOT NULL;

UPDATE office_vehicle
SET created_by = COALESCE(created_by, owner_user_id)
WHERE created_by IS NULL;

UPDATE office_vehicle_expense
SET created_by = COALESCE(created_by, handler_id)
WHERE created_by IS NULL;

UPDATE office_vehicle_license item
JOIN office_vehicle vehicle ON vehicle.id = item.vehicle_id
SET item.created_by = vehicle.created_by
WHERE item.created_by IS NULL;

UPDATE office_vehicle_insurance item
JOIN office_vehicle vehicle ON vehicle.id = item.vehicle_id
SET item.created_by = vehicle.created_by
WHERE item.created_by IS NULL;

UPDATE office_vehicle_reminder item
JOIN office_vehicle vehicle ON vehicle.id = item.vehicle_id
SET item.created_by = vehicle.created_by
WHERE item.created_by IS NULL;
