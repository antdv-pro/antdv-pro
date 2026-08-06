USE enterprise_system;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'office_vehicle_insurance' AND COLUMN_NAME = 'attachment_url') = 0,
  'ALTER TABLE office_vehicle_insurance ADD COLUMN attachment_url VARCHAR(512) NULL AFTER attachment_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
