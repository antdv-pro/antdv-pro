USE enterprise_system;

INSERT INTO sys_company (id, code, name, status) VALUES
  (1, 'COMP001', '青海诚捷运输有限公司', 'enabled')
ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status);

INSERT INTO sys_department (id, company_id, parent_id, code, name, sort_no, status) VALUES
  (1, 1, NULL, 'DEPT001', '总经办', 10, 'enabled'),
  (2, 1, NULL, 'DEPT002', '财务部', 20, 'enabled'),
  (3, 1, NULL, 'DEPT003', '运输部', 30, 'enabled'),
  (4, 1, NULL, 'DEPT004', '综合管理部', 40, 'enabled')
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_no = VALUES(sort_no), status = VALUES(status);

INSERT INTO sys_post (id, dept_id, code, name, sort_no, status) VALUES
  (1, 4, 'POST001', '系统管理员', 1, 'enabled'),
  (2, 2, 'POST002', '财务会计', 2, 'enabled'),
  (3, 3, 'POST003', '审批负责人', 3, 'enabled'),
  (4, 3, 'POST004', '驾驶员', 4, 'enabled')
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_no = VALUES(sort_no), status = VALUES(status);

INSERT INTO sys_role (id, code, name, data_scope, status, remark) VALUES
  (1, 'ADMIN', '管理员', 'all', 'enabled', '拥有全部菜单、按钮和数据权限'),
  (2, 'USER', '普通员工', 'self', 'enabled', '本人数据权限'),
  (3, 'FINANCE_MANAGER', '财务', 'company', 'enabled', '本公司财务数据权限'),
  (4, 'APPROVER', '审批人', 'department', 'enabled', '审批待办和相关业务数据'),
  (5, 'DEPT_LEADER', '部门负责人', 'department', 'enabled', '本部门数据权限')
ON DUPLICATE KEY UPDATE name = VALUES(name), data_scope = VALUES(data_scope), status = VALUES(status), remark = VALUES(remark);

-- 管理员由 API 在首次登录时使用 ADMIN_INITIAL_PASSWORD 安全创建。
-- 不在 SQL 种子中保存固定或共享的默认凭据。

INSERT INTO sys_dict (type, type_name, label, value, sort_no, status) VALUES
  ('fee_type', '费用类型', '保险费', 'insurance', 1, 'enabled'),
  ('fee_type', '费用类型', '年审费', 'annual_check', 2, 'enabled'),
  ('fee_type', '费用类型', '营运证费', 'transport_permit_fee', 3, 'enabled'),
  ('approval_status', '审批状态', '草稿', 'draft', 1, 'enabled'),
  ('approval_status', '审批状态', '审批中', 'approving', 2, 'enabled'),
  ('approval_status', '审批状态', '已通过', 'approved', 3, 'enabled'),
  ('approval_status', '审批状态', '已驳回', 'rejected', 4, 'enabled'),
  ('vehicle_status', '车辆状态', '正常', 'normal', 1, 'enabled'),
  ('vehicle_status', '车辆状态', '维修中', 'repairing', 2, 'enabled'),
  ('vehicle_status', '车辆状态', '停用', 'disabled', 3, 'enabled'),
  ('license_type', '证照类型', '行驶证', 'driving_permit', 1, 'enabled'),
  ('license_type', '证照类型', '营运证', 'transport_permit', 2, 'enabled'),
  ('payment_method', '支付方式', '银行转账', 'bank_transfer', 1, 'enabled'),
  ('payment_method', '支付方式', '现金', 'cash', 2, 'enabled'),
  ('payment_method', '支付方式', '微信', 'wechat', 3, 'enabled'),
  ('payment_method', '支付方式', '支付宝', 'alipay', 4, 'enabled')
ON DUPLICATE KEY UPDATE label = VALUES(label), sort_no = VALUES(sort_no), status = VALUES(status);

INSERT INTO sys_menu (id, parent_id, name, title, path, component, redirect, icon, permission_code, menu_type, sort_no, status) VALUES
  (1, NULL, 'DashboardWorkplace', '首页', '/dashboard/workplace', '/dashboard/workplace', NULL, 'HomeOutlined', 'dashboard:view', 'menu', 1, 'enabled'),
  (2, NULL, 'OAApproval', 'OA办公审批', '/oa-approval', 'RouteView', '/oa-approval/dashboard', 'AuditOutlined', 'oa:view', 'menu', 2, 'enabled'),
  (4, 2, 'ApprovalCenter', '审批中心', '/oa-approval/center', '/approval/index', NULL, NULL, 'approval:center:view', 'menu', 21, 'enabled'),
  (907, 2, 'WecomApprovalIntegration', '企业微信互通', '/oa-approval/wecom', '/approval/wecom', NULL, NULL, 'approval:wecom:manage', 'menu', 29, 'enabled'),
  (9, 2, 'OaOfficeVehicle', '办公用车', '/oa-approval/vehicle', '/approval/office-vehicle/index', NULL, NULL, 'office-vehicle:view', 'menu', 22, 'enabled'),
  (10, NULL, 'Transport', '运输管理', '/transport', 'RouteView', '/transport/operations', 'CarOutlined', 'transport:view', 'menu', 3, 'enabled'),
  (15, 10, 'TransportFees', '规费管理', '/transport/fees', '/transport/fees', NULL, NULL, 'transport:fees:view', 'menu', 31, 'enabled'),
  (18, 10, 'TransportVehicleLoans', '车贷费用', '/transport/vehicle-loans', '/transport/vehicle-loans', NULL, NULL, 'transport:vehicle-loans:view', 'menu', 32, 'enabled'),
  (190, 10, 'TransportBaseData', '基础数据', '/transport/base-data', '/transport/base-data', NULL, NULL, 'transport:base-data:view', 'menu', 98, 'enabled'),
  (191, 10, 'TransportSiteCredentials', '帐号网址', '/transport/site-credentials', '/transport/site-credentials', NULL, NULL, 'transport:site-credentials:view', 'menu', 99, 'enabled'),
  (60, NULL, 'System', '系统管理', '/system', 'RouteView', '/system/users', 'SettingOutlined', 'system:view', 'menu', 9, 'enabled'),
  (61, 60, 'SystemUsers', '用户管理', '/system/users', '/system/index', NULL, NULL, 'system:user:view', 'menu', 91, 'enabled'),
  (62, 60, 'SystemOrganization', '组织架构', '/system/organization', '/system/index', NULL, NULL, 'system:org:view', 'menu', 92, 'enabled'),
  (63, 60, 'SystemRoles', '角色权限', '/system/roles', '/system/index', NULL, NULL, 'system:role:view', 'menu', 93, 'enabled'),
  (64, 60, 'SystemDictionaries', '系统字典', '/system/dictionaries', '/system/index', NULL, NULL, 'system:dict:view', 'menu', 94, 'enabled'),
  (65, 60, 'SystemLogs', '安全日志', '/system/logs', '/system/index', NULL, NULL, 'system:log:view', 'menu', 95, 'enabled')
ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path), component = VALUES(component), status = VALUES(status);

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, id FROM sys_menu
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  (2, 1),
  (3, 1), (3, 2), (3, 4), (3, 9), (3, 10), (3, 15), (3, 18),
  (4, 1), (4, 2), (4, 4),
  (5, 1), (5, 2), (5, 4), (5, 10), (5, 15), (5, 18)
ON DUPLICATE KEY UPDATE menu_id = VALUES(menu_id);

INSERT INTO sys_role_button (role_id, button_code) VALUES
  (1, 'view'), (1, 'create'), (1, 'update'), (1, 'delete'), (1, 'approve'), (1, 'export'),
  (2, 'view'), (2, 'create'),
  (3, 'view'), (3, 'create'), (3, 'update'), (3, 'approve'), (3, 'export'),
  (4, 'view'), (4, 'approve'),
  (5, 'view'), (5, 'create'), (5, 'update'), (5, 'approve'), (5, 'export')
ON DUPLICATE KEY UPDATE button_code = VALUES(button_code);
