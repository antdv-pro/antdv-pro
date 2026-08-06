CREATE TABLE IF NOT EXISTS hotel_daily_operation (
  business_date DATE PRIMARY KEY,
  total_rooms SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  occupied_rooms SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  remark VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_hotel_daily_total_rooms CHECK (total_rooms = 100),
  CONSTRAINT chk_hotel_daily_occupied_rooms CHECK (occupied_rooms <= total_rooms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
