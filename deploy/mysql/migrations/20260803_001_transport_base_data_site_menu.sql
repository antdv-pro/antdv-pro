-- Ensure the transport menu keeps Base Data immediately before Site Credentials.
INSERT INTO sys_menu (id, parent_id, name, title, path, component, redirect, icon, permission_code, menu_type, sort_no, status)
VALUES
  (190, 10, 'TransportBaseData', '基础数据', '/transport/base-data', '/transport/base-data', NULL, NULL, 'transport:base-data:view', 'menu', 98, 'enabled'),
  (191, 10, 'TransportSiteCredentials', '帐号网址', '/transport/site-credentials', '/transport/site-credentials', NULL, NULL, 'transport:site-credentials:view', 'menu', 99, 'enabled')
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  title = VALUES(title),
  path = VALUES(path),
  component = VALUES(component),
  permission_code = VALUES(permission_code),
  sort_no = VALUES(sort_no),
  status = VALUES(status);

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM sys_role r
JOIN sys_menu m ON m.id IN (190, 191)
WHERE r.code IN ('ADMIN', 'USER', 'FINANCE_MANAGER', 'APPROVER', 'DEPT_LEADER')
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);
