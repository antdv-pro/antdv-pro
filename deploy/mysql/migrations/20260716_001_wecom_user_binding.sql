ALTER TABLE sys_user
  ADD COLUMN wecom_user_id VARCHAR(128) NULL AFTER email,
  ADD COLUMN wecom_department_id VARCHAR(64) NULL AFTER wecom_user_id,
  ADD UNIQUE KEY uk_sys_user_wecom (wecom_user_id);
