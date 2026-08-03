USE enterprise_system;

CREATE TABLE IF NOT EXISTS approval_template (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  business_types JSON NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_approval_template_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_template_node (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  node_name VARCHAR(128) NOT NULL,
  order_no INT NOT NULL DEFAULT 0,
  approver_type VARCHAR(32) NOT NULL,
  approver_ids JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_approval_template_node_template (template_id, order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_instance (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  template_id VARCHAR(64) NULL,
  approval_type VARCHAR(128) NOT NULL,
  business_module VARCHAR(64) NULL,
  business_type VARCHAR(64) NOT NULL,
  business_id VARCHAR(64) NOT NULL,
  business_no VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  applicant_id VARCHAR(64) NOT NULL,
  applicant_name VARCHAR(128) NOT NULL,
  dept_id VARCHAR(64) NULL,
  dept_name VARCHAR(128) NULL,
  amount DECIMAL(14, 2) NULL,
  status VARCHAR(32) NOT NULL,
  business_status VARCHAR(32) NOT NULL,
  current_node_id VARCHAR(64) NULL,
  current_node_name VARCHAR(128) NULL,
  form_snapshot JSON NULL,
  payload JSON NULL,
  cc_user_ids JSON NULL,
  submitted_at DATETIME NULL,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  revoked_at DATETIME NULL,
  business_applied_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_approval_instance_business (business_type, business_id),
  KEY idx_approval_instance_status (status),
  KEY idx_approval_instance_applicant (applicant_id),
  KEY idx_approval_instance_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_node (
  id VARCHAR(64) PRIMARY KEY,
  instance_id VARCHAR(64) NOT NULL,
  template_node_id VARCHAR(64) NULL,
  node_name VARCHAR(128) NOT NULL,
  order_no INT NOT NULL DEFAULT 0,
  approver_type VARCHAR(32) NOT NULL,
  approver_ids JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_approval_node_instance (instance_id, order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_task (
  id VARCHAR(64) PRIMARY KEY,
  instance_id VARCHAR(64) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  node_name VARCHAR(128) NOT NULL,
  assignee_id VARCHAR(64) NOT NULL,
  assignee_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  action VARCHAR(32) NULL,
  comment VARCHAR(1000) NULL,
  acted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_approval_task_assignee_status (assignee_id, status),
  KEY idx_approval_task_instance (instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_log (
  id VARCHAR(64) PRIMARY KEY,
  instance_id VARCHAR(64) NOT NULL,
  task_id VARCHAR(64) NULL,
  action VARCHAR(32) NOT NULL,
  operator_id VARCHAR(64) NOT NULL,
  operator_name VARCHAR(128) NOT NULL,
  comment VARCHAR(1000) NULL,
  from_user_id VARCHAR(64) NULL,
  to_user_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_log_instance (instance_id),
  KEY idx_approval_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_cc (
  id VARCHAR(64) PRIMARY KEY,
  instance_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(128) NOT NULL,
  is_read TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_cc_user (user_id, is_read),
  KEY idx_approval_cc_instance (instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_message (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  instance_id VARCHAR(64) NOT NULL,
  is_read TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_message_user_read (user_id, is_read),
  KEY idx_approval_message_instance (instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_business_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  business_type VARCHAR(64) NOT NULL,
  business_id VARCHAR(64) NOT NULL,
  business_no VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  business_status VARCHAR(32) NOT NULL,
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_approval_business_record (business_type, business_id),
  KEY idx_approval_business_status (business_status),
  KEY idx_approval_business_instance (approval_instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_generic_business_record (
  id VARCHAR(64) PRIMARY KEY,
  approval_instance_id VARCHAR(64) NOT NULL,
  business_type VARCHAR(64) NOT NULL,
  business_module VARCHAR(128) NULL,
  business_id VARCHAR(64) NOT NULL,
  business_no VARCHAR(128) NULL,
  title VARCHAR(255) NOT NULL,
  business_status VARCHAR(32) NOT NULL,
  amount DECIMAL(14, 2) NULL,
  payload JSON NULL,
  applied TINYINT NOT NULL DEFAULT 0,
  applied_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_approval_generic_instance (approval_instance_id),
  KEY idx_approval_generic_business (business_type, business_id),
  KEY idx_approval_generic_status (business_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_cash_account (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_cash_flow (
  id VARCHAR(64) PRIMARY KEY,
  approval_instance_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  flow_type VARCHAR(32) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_approval_cash_flow_instance (approval_instance_id),
  KEY idx_approval_cash_flow_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_leave_balance (
  employee_id VARCHAR(64) PRIMARY KEY,
  annual_leave_days DECIMAL(8, 2) NOT NULL DEFAULT 0,
  used_leave_days DECIMAL(8, 2) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_employee (
  id VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NULL,
  employee_no VARCHAR(64) NOT NULL UNIQUE,
  employee_name VARCHAR(128) NOT NULL,
  company_id BIGINT NULL,
  company_name VARCHAR(128) NULL,
  dept_id BIGINT NULL,
  dept_name VARCHAR(128) NULL,
  post_id BIGINT NULL,
  post_name VARCHAR(128) NULL,
  leader_id BIGINT NULL,
  leader_name VARCHAR(128) NULL,
  approver_id BIGINT NULL,
  approver_name VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(128) NULL,
  hire_date DATE NULL,
  status VARCHAR(32) NOT NULL DEFAULT '在职',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_hr_employee_user (user_id),
  KEY idx_hr_employee_dept (dept_id),
  KEY idx_hr_employee_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_salary_template (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  basic_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  performance_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  seniority_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  overtime_allowance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  travel_allowance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  retroactive_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  social_security_base DECIMAL(14, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT '启用',
  effective_date DATE NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_hr_salary_template_employee (employee_id),
  KEY idx_hr_salary_template_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_salary_record (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  employee_id VARCHAR(64) NOT NULL,
  employee_name VARCHAR(128) NOT NULL,
  company_name VARCHAR(128) NULL,
  dept_name VARCHAR(128) NULL,
  post_name VARCHAR(128) NULL,
  financial_year INT NOT NULL,
  financial_month INT NOT NULL,
  attendance_days DECIMAL(5, 2) NOT NULL DEFAULT 31,
  basic_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  performance_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  gross_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  attendance_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  seniority_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  overtime_allowance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  travel_allowance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  retroactive_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  social_security_base DECIMAL(14, 2) NOT NULL DEFAULT 0,
  company_pension DECIMAL(14, 2) NOT NULL DEFAULT 0,
  company_medical DECIMAL(14, 2) NOT NULL DEFAULT 0,
  company_injury DECIMAL(14, 2) NOT NULL DEFAULT 0,
  company_unemployment DECIMAL(14, 2) NOT NULL DEFAULT 0,
  company_social_security_total DECIMAL(14, 2) NOT NULL DEFAULT 0,
  personal_pension DECIMAL(14, 2) NOT NULL DEFAULT 0,
  personal_medical DECIMAL(14, 2) NOT NULL DEFAULT 0,
  personal_injury DECIMAL(14, 2) NOT NULL DEFAULT 0,
  personal_unemployment DECIMAL(14, 2) NOT NULL DEFAULT 0,
  personal_social_security_total DECIMAL(14, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(14, 2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(14, 2) NOT NULL DEFAULT 0,
  cash_payment DECIMAL(14, 2) NOT NULL DEFAULT 0,
  pay_status VARCHAR(32) NOT NULL DEFAULT '未发放',
  approval_status VARCHAR(32) NOT NULL DEFAULT '草稿',
  approval_instance_id VARCHAR(64) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_hr_salary_record_employee_month (employee_id, financial_year, financial_month),
  KEY idx_hr_salary_record_month (financial_year, financial_month),
  KEY idx_hr_salary_record_approval (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finance_receivable_payable (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  counterparty VARCHAR(128) NOT NULL,
  bill_type VARCHAR(32) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  unpaid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  due_date DATE NULL,
  bill_date DATE NULL,
  related_bill VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL,
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  remark VARCHAR(512) NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_finance_rp_type_status (bill_type, status),
  KEY idx_finance_rp_due (due_date),
  KEY idx_finance_rp_month (financial_year, financial_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finance_cash_flow (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  account_name VARCHAR(128) NOT NULL,
  account_type VARCHAR(64) NOT NULL,
  opening_balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  income_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  expense_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
  flow_date DATE NOT NULL,
  flow_type VARCHAR(64) NOT NULL,
  related_bill VARCHAR(128) NULL,
  handler VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL,
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  remark VARCHAR(512) NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_finance_cash_flow_account_date (account_name, flow_date),
  KEY idx_finance_cash_flow_month (financial_year, financial_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finance_cash_balance (
  id VARCHAR(64) PRIMARY KEY,
  balance_json JSON NULL,
  balance_date DATE NOT NULL,
  company_name VARCHAR(128) NOT NULL,
  bank_name VARCHAR(128) NOT NULL,
  account_name VARCHAR(128) NOT NULL,
  account_no_tail VARCHAR(32) NULL,
  balance_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  remark VARCHAR(512) NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(64) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_finance_cash_balance_date (balance_date),
  KEY idx_finance_cash_balance_company (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oa_dashboard_record (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  code VARCHAR(64) NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NULL,
  record_date DATE NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_oa_dashboard_month (financial_year, financial_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oa_org_record (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  code VARCHAR(64) NULL,
  org_type VARCHAR(32) NULL,
  name VARCHAR(128) NULL,
  parent_department VARCHAR(128) NULL,
  status VARCHAR(32) NULL,
  record_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_oa_org_type (org_type),
  KEY idx_oa_org_parent (parent_department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oa_vehicle_record (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  code VARCHAR(64) NULL,
  plate_no VARCHAR(32) NULL,
  applicant VARCHAR(128) NULL,
  department VARCHAR(128) NULL,
  total_fee DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NULL,
  record_date DATE NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_oa_vehicle_plate (plate_no),
  KEY idx_oa_vehicle_month (financial_year, financial_month)
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
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
  created_at DATETIME NOT NULL,
  KEY idx_office_vehicle_operation_log_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_company (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  tax_no VARCHAR(64) NULL,
  contact VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '正常',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_customer (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  area VARCHAR(128) NULL,
  contact VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '正常',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_customer_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_vehicle (
  id VARCHAR(64) PRIMARY KEY,
  plate_no VARCHAR(32) NOT NULL UNIQUE,
  trailer_no VARCHAR(32) NULL,
  area VARCHAR(128) NULL,
  fuel_type VARCHAR(64) NULL,
  driver_id VARCHAR(64) NULL,
  driver_name VARCHAR(128) NULL,
  escort_id VARCHAR(64) NULL,
  escort_name VARCHAR(128) NULL,
  mileage DECIMAL(14, 2) NOT NULL DEFAULT 0,
  purchase_date DATE NULL,
  vehicle_age_type VARCHAR(64) NULL,
  scrap_date DATE NULL,
  status VARCHAR(32) NOT NULL DEFAULT '正常',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_vehicle_status (status),
  KEY idx_transport_vehicle_driver (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_crew (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  crew_name VARCHAR(128) NOT NULL,
  crew_type VARCHAR(32) NOT NULL DEFAULT '司机',
  phone VARCHAR(32) NULL,
  vehicle_id VARCHAR(64) NULL,
  plate_no VARCHAR(32) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '在职',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_crew_vehicle (vehicle_id),
  KEY idx_transport_crew_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_route (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  customer_id VARCHAR(64) NULL,
  customer_name VARCHAR(128) NULL,
  route_name VARCHAR(255) NOT NULL,
  loading_address VARCHAR(255) NULL,
  unloading_address VARCHAR(255) NULL,
  distance_km DECIMAL(12, 2) NOT NULL DEFAULT 0,
  pricing_formula VARCHAR(32) NOT NULL DEFAULT '吨位×单价',
  freight_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  extra_fee DECIMAL(14, 2) NOT NULL DEFAULT 0,
  planned_fuel_new_gas DECIMAL(12, 2) NOT NULL DEFAULT 0,
  planned_fuel_old_gas DECIMAL(12, 2) NOT NULL DEFAULT 0,
  planned_fuel_new_diesel DECIMAL(12, 2) NOT NULL DEFAULT 0,
  planned_fuel_old_diesel DECIMAL(12, 2) NOT NULL DEFAULT 0,
  round_trip_planned_fuel_new_gas DECIMAL(12, 2) NOT NULL DEFAULT 0,
  round_trip_planned_fuel_old_gas DECIMAL(12, 2) NOT NULL DEFAULT 0,
  round_trip_planned_fuel_new_diesel DECIMAL(12, 2) NOT NULL DEFAULT 0,
  round_trip_planned_fuel_old_diesel DECIMAL(12, 2) NOT NULL DEFAULT 0,
  loading_fence_id VARCHAR(64) NULL,
  unloading_fence_id VARCHAR(64) NULL,
  return_fence_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '正常',
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_route_customer (customer_id),
  KEY idx_transport_route_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_order (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  financial_year INT NULL,
  financial_month INT NULL,
  ship_date DATE NOT NULL,
  customer_id VARCHAR(64) NULL,
  customer_name VARCHAR(128) NOT NULL,
  vehicle_id VARCHAR(64) NULL,
  plate_no VARCHAR(32) NOT NULL,
  trailer_no VARCHAR(32) NULL,
  driver_id VARCHAR(64) NULL,
  driver_name VARCHAR(128) NULL,
  escort_id VARCHAR(64) NULL,
  escort_name VARCHAR(128) NULL,
  route_id VARCHAR(64) NULL,
  route_name VARCHAR(255) NULL,
  loading_address VARCHAR(255) NULL,
  unloading_address VARCHAR(255) NULL,
  order_type VARCHAR(64) NULL,
  cargo_name VARCHAR(128) NULL,
  sent_weight DECIMAL(14, 3) NOT NULL DEFAULT 0,
  received_weight DECIMAL(14, 3) NOT NULL DEFAULT 0,
  distance_km DECIMAL(12, 2) NOT NULL DEFAULT 0,
  pricing_formula VARCHAR(32) NOT NULL DEFAULT '吨位×单价',
  freight_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  freight_total DECIMAL(14, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.09,
  taxed_freight DECIMAL(14, 2) NOT NULL DEFAULT 0,
  planned_fuel_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  actual_fuel_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  actual_fuel_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  etc_fee DECIMAL(14, 2) NOT NULL DEFAULT 0,
  receipt_status VARCHAR(32) NULL,
  settlement_status VARCHAR(32) NULL,
  transport_status VARCHAR(32) NOT NULL DEFAULT '装车',
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_order_vehicle_date (plate_no, ship_date),
  KEY idx_transport_order_month (financial_year, financial_month),
  KEY idx_transport_order_customer (customer_id),
  KEY idx_transport_order_route (route_id),
  KEY idx_transport_order_status (transport_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_fuel_record (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  order_id VARCHAR(64) NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  fuel_time DATETIME NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  location VARCHAR(255) NULL,
  product VARCHAR(64) NULL,
  quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  driver_name VARCHAR(128) NULL,
  source_batch_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_fuel_plate_time (plate_no, fuel_time),
  KEY idx_transport_fuel_order (order_id),
  KEY idx_transport_fuel_month (financial_year, financial_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_etc_record (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  order_id VARCHAR(64) NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  pass_time DATETIME NOT NULL,
  road_section VARCHAR(255) NULL,
  plate_no VARCHAR(32) NOT NULL,
  card_no VARCHAR(128) NULL,
  invoice_no VARCHAR(128) NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NULL,
  source_batch_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_etc_plate_time (plate_no, pass_time),
  KEY idx_transport_etc_order (order_id),
  KEY idx_transport_etc_month (financial_year, financial_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_maintenance_order (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  vehicle_id VARCHAR(64) NULL,
  plate_no VARCHAR(32) NOT NULL,
  trailer_no VARCHAR(32) NULL,
  repair_date DATE NOT NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  project VARCHAR(128) NOT NULL,
  shop VARCHAR(128) NULL,
  mileage DECIMAL(14, 2) NOT NULL DEFAULT 0,
  items TEXT NULL,
  pay_type VARCHAR(64) NULL,
  driver_name VARCHAR(128) NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_maintenance_plate_date (plate_no, repair_date),
  KEY idx_transport_maintenance_month (financial_year, financial_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_vehicle_loan (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NULL,
  contract_no VARCHAR(64) NOT NULL UNIQUE,
  vehicle_id VARCHAR(64) NULL,
  plate_no VARCHAR(32) NOT NULL,
  trailer_no VARCHAR(32) NULL,
  lender VARCHAR(128) NOT NULL,
  loan_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  principal_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  annual_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  total_periods INT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  first_due_date DATE NOT NULL,
  monthly_payment DECIMAL(14, 2) NOT NULL DEFAULT 0,
  owner VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT '还款中',
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_vehicle_loan_plate (plate_no),
  KEY idx_transport_vehicle_loan_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_vehicle_loan_payment (
  id VARCHAR(64) PRIMARY KEY,
  loan_id VARCHAR(64) NOT NULL,
  period_no INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  principal DECIMAL(14, 2) NOT NULL DEFAULT 0,
  interest DECIMAL(14, 2) NOT NULL DEFAULT 0,
  method VARCHAR(64) NULL,
  voucher_no VARCHAR(128) NULL,
  remark VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_transport_loan_payment_period (loan_id, period_no),
  KEY idx_transport_loan_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transport_driver_payroll (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  payroll_json JSON NOT NULL,
  driver_name VARCHAR(128) NULL,
  plate_no VARCHAR(32) NULL,
  financial_year INT NULL,
  financial_month INT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NULL,
  approval_status VARCHAR(32) NULL,
  approval_instance_id VARCHAR(64) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_transport_driver_payroll_month (financial_year, financial_month),
  KEY idx_transport_driver_payroll_plate (plate_no)
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
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  KEY idx_regulatory_fee_valid_date (valid_start_date, valid_end_date),
  KEY idx_regulatory_fee_type (fee_type),
  KEY idx_regulatory_fee_plate_no (plate_no),
  KEY idx_regulatory_fee_approval (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_provider_config (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  provider VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_provider_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_transport_vehicle (
  vehicle_id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  driver_name VARCHAR(128) NULL,
  owner_user_id VARCHAR(64) NULL,
  current_order_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_vehicle_plate (plate_no),
  KEY idx_gps_vehicle_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_device (
  device_id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  device_no VARCHAR(128) NOT NULL,
  device_name VARCHAR(128) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  online_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_device_no (device_no),
  KEY idx_gps_device_status (online_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_vehicle_device_bind (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  vehicle_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  bind_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_gps_bind_vehicle (vehicle_id),
  UNIQUE KEY uk_gps_bind_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_location_latest (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  vehicle_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  latitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
  longitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
  speed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  online_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
  location_time DATETIME NULL,
  provider VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_gps_location_device (device_id),
  KEY idx_gps_location_vehicle (vehicle_id),
  KEY idx_gps_location_time (location_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_track_point (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  vehicle_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  latitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
  longitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
  speed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  location_time DATETIME NULL,
  provider VARCHAR(32) NOT NULL,
  business_type VARCHAR(64) NULL,
  business_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_track_vehicle_time (vehicle_id, location_time),
  KEY idx_gps_track_business (business_type, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_alarm (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  vehicle_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(64) NOT NULL,
  plate_no VARCHAR(32) NOT NULL,
  alarm_type VARCHAR(64) NOT NULL,
  alarm_level VARCHAR(32) NOT NULL,
  alarm_time DATETIME NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unhandled',
  provider VARCHAR(32) NOT NULL,
  business_type VARCHAR(64) NULL,
  business_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_alarm_vehicle_time (vehicle_id, alarm_time),
  KEY idx_gps_alarm_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_geofence (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  name VARCHAR(128) NOT NULL,
  shape VARCHAR(32) NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_geofence_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_geofence_vehicle (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  geofence_id VARCHAR(64) NOT NULL,
  vehicle_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_geofence_vehicle_fence (geofence_id),
  KEY idx_gps_geofence_vehicle_vehicle (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_sync_log (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  provider VARCHAR(32) NOT NULL,
  sync_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_sync_log_finished (finished_at),
  KEY idx_gps_sync_log_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gps_operation_log (
  id VARCHAR(64) PRIMARY KEY,
  record_json JSON NOT NULL,
  action VARCHAR(64) NOT NULL,
  operator_id VARCHAR(64) NULL,
  operator_name VARCHAR(128) NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_gps_operation_log_target (target_type, target_id),
  KEY idx_gps_operation_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trade_order (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(128) NOT NULL UNIQUE,
  order_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_trade_order_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotel_revenue (
  id VARCHAR(64) PRIMARY KEY,
  revenue_date DATE NOT NULL,
  revenue_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_hotel_revenue_date (revenue_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bill_reconciliation_archive (
  id VARCHAR(64) PRIMARY KEY,
  archive_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_bill_reconciliation_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
