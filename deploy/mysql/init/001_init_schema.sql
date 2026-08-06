CREATE DATABASE IF NOT EXISTS enterprise_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE enterprise_system;

CREATE TABLE IF NOT EXISTS sys_company (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_department (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  leader_user_id BIGINT NULL,
  sort_no INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sys_department_company (company_id),
  INDEX idx_sys_department_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_post (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dept_id BIGINT NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  sort_no INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sys_post_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(64) NOT NULL,
  mobile VARCHAR(32) NULL,
  email VARCHAR(128) NULL,
  password_salt VARCHAR(64) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  company_id BIGINT NULL,
  dept_id BIGINT NULL,
  post_id BIGINT NULL,
  leader_user_id BIGINT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sys_user_dept (dept_id),
  INDEX idx_sys_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  data_scope VARCHAR(32) NOT NULL DEFAULT 'self',
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_user_role (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  INDEX idx_sys_user_role_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_menu (
  id BIGINT PRIMARY KEY,
  parent_id BIGINT NULL,
  name VARCHAR(128) NOT NULL,
  title VARCHAR(128) NOT NULL,
  path VARCHAR(255) NOT NULL,
  component VARCHAR(255) NULL,
  redirect VARCHAR(255) NULL,
  icon VARCHAR(64) NULL,
  permission_code VARCHAR(128) NULL,
  menu_type VARCHAR(20) NOT NULL DEFAULT 'menu',
  sort_no INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sys_menu_parent (parent_id),
  INDEX idx_sys_menu_path (path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role_menu (
  role_id BIGINT NOT NULL,
  menu_id BIGINT NOT NULL,
  PRIMARY KEY (role_id, menu_id),
  INDEX idx_sys_role_menu_menu (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_role_button (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  button_code VARCHAR(64) NOT NULL,
  UNIQUE KEY uk_role_button (role_id, button_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_dict (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(64) NOT NULL,
  type_name VARCHAR(128) NOT NULL,
  label VARCHAR(128) NOT NULL,
  value VARCHAR(128) NOT NULL,
  sort_no INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sys_dict_type_value (type, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_login_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  nickname VARCHAR(64) NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL,
  message VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sys_login_log_username (username),
  INDEX idx_sys_login_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_operation_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  module VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  operator_id BIGINT NULL,
  operator_name VARCHAR(64) NULL,
  target_id VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sys_operation_log_action (action),
  INDEX idx_sys_operation_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sys_attachment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  biz_type VARCHAR(64) NOT NULL,
  biz_id VARCHAR(128) NULL,
  original_name VARCHAR(255) NOT NULL,
  object_key VARCHAR(500) NOT NULL,
  content_type VARCHAR(128) NULL,
  file_size BIGINT NOT NULL,
  storage_provider VARCHAR(32) NOT NULL DEFAULT 'aliyun_oss',
  uploader_id BIGINT NULL,
  uploader_name VARCHAR(64) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sys_attachment_biz (biz_type, biz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS regulatory_fee (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  fee_name VARCHAR(100) NOT NULL,
  fee_type VARCHAR(50) NOT NULL,
  plate_no VARCHAR(32) NULL,
  trailer_no VARCHAR(32) NULL,
  area VARCHAR(100) NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  valid_start_date DATE NOT NULL,
  valid_end_date DATE NOT NULL,
  valid_months INT NOT NULL,
  monthly_amortized_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  manual_status VARCHAR(20) NOT NULL DEFAULT 'enabled',
  approval_status VARCHAR(32) NOT NULL DEFAULT '草稿',
  approval_instance_id VARCHAR(64) NULL,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  revoked_at DATETIME NULL,
  remark VARCHAR(500) NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_regulatory_fee_valid_date (valid_start_date, valid_end_date),
  KEY idx_regulatory_fee_type (fee_type),
  KEY idx_regulatory_fee_plate_no (plate_no),
  KEY idx_regulatory_fee_approval (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS office_vehicle (
  id VARCHAR(64) PRIMARY KEY,
  plate_no VARCHAR(32) NOT NULL UNIQUE,
  vehicle_type VARCHAR(64) NOT NULL,
  brand_model VARCHAR(128) NOT NULL,
  department_id VARCHAR(64) NULL,
  department_name VARCHAR(128) NOT NULL,
  owner_user_id VARCHAR(64) NULL,
  owner_name VARCHAR(128) NOT NULL,
  default_driver_id VARCHAR(64) NULL,
  default_driver_name VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '正常',
  purchase_date DATE NULL,
  photo_url VARCHAR(512) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_office_vehicle_status (status),
  KEY idx_office_vehicle_department (department_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS office_vehicle_expense (
  id VARCHAR(64) PRIMARY KEY,
  vehicle_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  expense_type VARCHAR(64) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  occurred_date DATE NOT NULL,
  handler_id VARCHAR(64) NULL,
  handler_name VARCHAR(128) NOT NULL,
  department_id VARCHAR(64) NULL,
  department_name VARCHAR(128) NOT NULL,
  payment_method VARCHAR(64) NOT NULL,
  invoice_no VARCHAR(128) NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_url VARCHAR(512) NULL,
  need_approval TINYINT NOT NULL DEFAULT 0,
  approval_status VARCHAR(32) NOT NULL DEFAULT '草稿',
  approval_instance_id VARCHAR(64) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_office_vehicle_expense_vehicle_date (vehicle_id, occurred_date),
  KEY idx_office_vehicle_expense_type (expense_type),
  KEY idx_office_vehicle_expense_status (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS office_vehicle_license (
  id VARCHAR(64) PRIMARY KEY,
  vehicle_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  license_type VARCHAR(64) NOT NULL,
  license_no VARCHAR(128) NOT NULL,
  issue_date DATE NULL,
  expiry_date DATE NOT NULL,
  issuing_authority VARCHAR(255) NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_url VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '有效',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_office_vehicle_license_vehicle (vehicle_id),
  KEY idx_office_vehicle_license_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS office_vehicle_insurance (
  id VARCHAR(64) PRIMARY KEY,
  vehicle_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  insurance_type VARCHAR(64) NOT NULL,
  policy_no VARCHAR(128) NOT NULL,
  insurer VARCHAR(128) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  attachment_name VARCHAR(255) NULL,
  attachment_url VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '有效',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_office_vehicle_insurance_vehicle (vehicle_id),
  KEY idx_office_vehicle_insurance_end_date (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS office_vehicle_reminder (
  id VARCHAR(64) PRIMARY KEY,
  vehicle_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  reminder_type VARCHAR(64) NOT NULL,
  due_date DATE NOT NULL,
  remind_days INT NOT NULL DEFAULT 30,
  target_user_ids VARCHAR(512) NULL,
  target_names VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '正常',
  handled TINYINT NOT NULL DEFAULT 0,
  handled_at DATETIME NULL,
  handle_remark VARCHAR(512) NULL,
  source_type VARCHAR(32) NULL,
  source_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_office_vehicle_reminder_due_date (due_date),
  KEY idx_office_vehicle_reminder_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS office_vehicle_operation_log (
  id VARCHAR(64) PRIMARY KEY,
  module VARCHAR(32) NOT NULL,
  record_id VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  operator_id VARCHAR(64) NULL,
  operator_name VARCHAR(128) NOT NULL,
  content VARCHAR(512) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_office_vehicle_operation_log_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_operation_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_type VARCHAR(64) NOT NULL,
  record_key VARCHAR(128) NOT NULL,
  record_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_transport_operation_record (record_type, record_key),
  KEY idx_transport_operation_type (record_type),
  KEY idx_transport_operation_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_state (
  id VARCHAR(64) PRIMARY KEY,
  state_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_state (
  id VARCHAR(64) PRIMARY KEY,
  state_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oa_module_state (
  id VARCHAR(64) PRIMARY KEY,
  state_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
