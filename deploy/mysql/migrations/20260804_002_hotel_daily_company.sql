-- Make hotel occupancy records tenant-scoped, matching hotel revenue.
SET @has_daily_company_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_daily_operation' AND COLUMN_NAME = 'company_id'
);
SET @hotel_daily_company_column_sql := IF(
  @has_daily_company_id = 0,
  'ALTER TABLE hotel_daily_operation ADD COLUMN company_id BIGINT NOT NULL DEFAULT 1 FIRST',
  'SELECT 1'
);
PREPARE hotel_daily_company_column_statement FROM @hotel_daily_company_column_sql;
EXECUTE hotel_daily_company_column_statement;
DEALLOCATE PREPARE hotel_daily_company_column_statement;

SET @daily_primary_key_sql := IF(
  EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_daily_operation'
      AND INDEX_NAME = 'PRIMARY' AND COLUMN_NAME = 'company_id'
  ),
  'SELECT 1',
  'ALTER TABLE hotel_daily_operation DROP PRIMARY KEY, ADD PRIMARY KEY (company_id, business_date)'
);
PREPARE hotel_daily_primary_key_statement FROM @daily_primary_key_sql;
EXECUTE hotel_daily_primary_key_statement;
DEALLOCATE PREPARE hotel_daily_primary_key_statement;
