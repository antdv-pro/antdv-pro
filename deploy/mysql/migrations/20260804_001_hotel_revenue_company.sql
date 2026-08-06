-- Align legacy hotel revenue rows with the company-scoped runtime store.
-- This migration is deliberately safe for databases where the column was
-- introduced manually before schema_migrations started tracking it.
SET @has_company_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_revenue' AND COLUMN_NAME = 'company_id'
);
SET @hotel_company_column_sql := IF(
  @has_company_id = 0,
  'ALTER TABLE hotel_revenue ADD COLUMN company_id BIGINT NOT NULL DEFAULT 1 AFTER id',
  'SELECT 1'
);
PREPARE hotel_company_column_statement FROM @hotel_company_column_sql;
EXECUTE hotel_company_column_statement;
DEALLOCATE PREPARE hotel_company_column_statement;

SET @has_company_date_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hotel_revenue' AND INDEX_NAME = 'idx_hotel_revenue_company_date'
);
SET @hotel_company_index_sql := IF(
  @has_company_date_index = 0,
  'CREATE INDEX idx_hotel_revenue_company_date ON hotel_revenue (company_id, revenue_date)',
  'SELECT 1'
);
PREPARE hotel_company_index_statement FROM @hotel_company_index_sql;
EXECUTE hotel_company_index_statement;
DEALLOCATE PREPARE hotel_company_index_statement;
