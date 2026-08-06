# 真实数据驱动改造清单

## 当前结论

项目当前已经具备一部分 MySQL 基础设施和 API 路由，但还不是完整真实数据驱动：

- 系统管理、规费、办公用车已经有较完整的结构化 MySQL 表。
- OA 模块、审批、运输运营、GPS 仍存在 `*_state` JSON 状态表、内存 seed 或本地 JSON 回退。
- 部分前端页面通过 `/api/...` 获取数据，但后端仍可能读写 JSON 聚合状态，不是逐业务表 CRUD。
- `storage/test-data` 仍承担本地 mock / seed 数据职责，后续只能保留为导入 seed 的来源，不能作为运行时数据源。

## 模块到表的拆分目标

| 模块 | 页面/入口 | 当前主要数据源 | 目标结构化表 | 替换优先级 |
| --- | --- | --- | --- | --- |
| 系统管理 | `/system/*` | `sys_*` 表 + `system-store` JSON 回退 | `sys_company`, `sys_department`, `sys_post`, `sys_user`, `sys_role`, `sys_dict`, `sys_login_log`, `sys_operation_log` | P1 |
| 审批中心 | `/oa-approval/center` | `approval_state.state_json` + 内存 state | `approval_template`, `approval_template_node`, `approval_instance`, `approval_node`, `approval_task`, `approval_log`, `approval_cc`, `approval_business_record` | P1 |
| OA 财务看板 | `/oa-approval/dashboard` | `oa_module_state.state_json` | 聚合查询，不单独落大 JSON；来源为审批、应收应付、现金、工资 | P2 |
| 应收应付 | `/oa-approval/receivable-payable` | `oa_module_state.modules.receivable` | `finance_receivable_payable` | P1 |
| 现金管理 | `/oa-approval/cash` | `oa_module_state.modules.cash` + `cashBalanceRecords` | `finance_cash_flow`, `finance_cash_balance` | P1 |
| 工资管理 | `/oa-approval/salary` | `oa_module_state.modules.salary/org` | `hr_employee`, `hr_salary_template`, `hr_salary_record` | P1 |
| OA 组织架构 | `/oa-approval/org` | `oa_module_state.modules.org` | 组织归并到 `sys_*`，员工扩展进 `hr_employee` | P1 |
| 办公用车 | `/oa-approval/vehicle` | 结构化表 + OA 聚合行 | `office_vehicle`, `office_vehicle_expense`, `office_vehicle_license`, `office_vehicle_insurance`, `office_vehicle_reminder`, `office_vehicle_operation_log` | P2 |
| 运输基础资料 | `/transport/base-data` | `transport/module.vue` 页面 rows | `transport_company`, `transport_customer`, `transport_vehicle`, `transport_crew`, `transport_route`, `transport_supplier`, `transport_fee_subject` | P1 |
| 帐号网址 | `/transport/site-credentials`（基础数据下方） | `transport_site_directory` | `transport_site_directory` | P2 |
| 运输订单 | `/transport/orders` | `transport_operation_record.record_json` | `transport_order` | P1 |
| 加油明细 | `/transport/fuel` | `transport_operation_record.record_json` | `transport_fuel_record` | P1 |
| 高速通行费 | `/transport/etc` | `transport_operation_record.record_json` | `transport_etc_record` | P1 |
| 运营数据 | `/transport/operations` | 前端聚合运输 JSON 数据，服务端缓存热数据 | 聚合查询，不落聚合大表；来源为订单、油费、ETC、维保、规费、工资、车贷；缓存由写操作主动失效 | P2 |
| 维保管理 | `/transport/maintenance` | `transport_operation_record.record_json` | `transport_maintenance_order` | P2 |
| 车贷费用 | `/transport/vehicle-loans` | `transport_operation_record.record_json` | `transport_vehicle_loan`, `transport_vehicle_loan_payment` | P2 |
| 规费管理 | `/transport/fees` | `regulatory_fee` | `regulatory_fee` | P3 |
| GPS/北斗 | `/transport/gps` | `gps_state.state_json` | `gps_provider_config`, `gps_device`, `gps_vehicle_bind`, `gps_location_latest`, `gps_track_point`, `gps_alarm`, `gps_geofence`, `gps_geofence_vehicle`, `gps_sync_log`, `gps_operation_log` | P3 |
| 贸易订单 | `/trade/orders` | `trade-order-store` | `trade_order` | P3 |
| 酒店营收 | `/hotel/revenue` | `hotel-revenue-store` | `hotel_revenue` | P3 |

## 字段命名原则

- 数据库字段使用 `snake_case`。
- 前端 TypeScript 接口继续使用 `camelCase`。
- API 层负责字段转换，不能让页面直接依赖数据库字段。
- 金额统一 `DECIMAL(14, 2)`，数量/重量/里程统一 `DECIMAL(14, 3)` 或 `DECIMAL(12, 2)`。
- 状态字段先保留中文展示值，后续可逐步改为字典编码 + label。
- 所有业务表保留 `created_at`, `updated_at`, `deleted_at`，列表默认过滤 `deleted_at IS NULL`。
- 审批相关业务表统一保留 `approval_status`, `approval_instance_id`, `approved_at`, `rejected_at`, `revoked_at`。

## 关联关系

### 运输

- `transport_order.vehicle_id -> transport_vehicle.id`
- `transport_order.customer_id -> transport_customer.id`
- `transport_order.route_id -> transport_route.id`
- `transport_fuel_record.order_id -> transport_order.id`
- `transport_etc_record.order_id -> transport_order.id`
- `transport_maintenance_order.vehicle_id -> transport_vehicle.id`
- `transport_vehicle_loan.vehicle_id -> transport_vehicle.id`
- `regulatory_fee.plate_no` 后续应补 `vehicle_id`，保留车牌兼容历史数据。

### 工资/OA

工资管理规则：打开任一财务月时，系统按在职人员幂等生成当月工资草稿，工资表不提供 Excel 导入和手动生成入口。工资模板负责带入固定工资和社保标准；未配置模板的在职人员仍会进入当月工资表，并明确标记待设置。月度表格只直接录入考勤天数、加班补助和出差补助，其余工资、个税及公司/个人社保由系统即时计算并随工资表导出。可编辑数字字段的零值在输入框中留空，首次聚焦时全选已有内容，以便键入新值直接替换；只读计算结果仍显示实际零值。公积金不再参与新模板、新计算或实发工资扣减；历史数据库字段暂保留兼容，不再写入新值。工资记录不提供“作废”操作。

工资锁定是服务端保护边界：批量锁定前页面展示异常记录并二次确认；`审批通过`、`已锁定`、`已发放`、`已作废`、`已归档`记录不可被普通分区保存接口删除、修改或回退状态。

- `hr_employee.user_id -> sys_user.id`
- `hr_employee.company_id -> sys_company.id`
- `hr_employee.dept_id -> sys_department.id`
- `hr_employee.post_id -> sys_post.id`
- `hr_salary_template.employee_id -> hr_employee.id`
- `hr_salary_record.employee_id -> hr_employee.id`
- `finance_receivable_payable.approval_instance_id -> approval_instance.id`
- `finance_cash_flow.approval_instance_id -> approval_instance.id`
- `finance_cash_flow.cash_balance_id -> finance_cash_balance.id`：来款登记必须绑定具体现金余额账户；历史来款在首次核销时补绑。

现金来款闭环规则：

- 来款登记代表真实到账，绑定账户后将整笔 `income_amount` 一次性增加到对应 `finance_cash_balance.balance_amount`。
- 应收核销只分配来款与应收单的关系，不得因分次核销重复增加账户余额。
- 每个账户在 `balance_json.balanceMovements` 保存到账前余额、到账后余额、来款流水、付款方、应收单、经办人与时间；后续拆表时迁移到独立 `finance_cash_movement` 表。
- 历史来款没有 `cash_balance_id` 时，首次核销必须选择具体账户并补记整笔到账；同一来款一旦绑定账户，不允许改绑。
- 来款入账和核销批次都使用唯一业务 ID 保证接口重试幂等。

### 审批

- `approval_instance.business_type + business_id` 关联任意业务表。
- `approval_business_record` 作为审批中心统一业务索引。
- 业务表审批状态由审批回调更新，避免页面手工改状态。

### 路线装卸车坐标识别

路线基础资料的装车、卸车地址支持自动补齐经纬度，坐标字段只作为后台数据保存，不在列表、编辑弹窗和导入预览中展示。打开路线基础资料或切换到路线页时，会对缺失坐标的既有记录执行一次回填；手工编辑地址失焦后重新解析，已有路线成功解析后自动后台保存地址、坐标并同步电子围栏；路线 Excel 导入在导入预览前触发。解析优先级为历史路线坐标、已存在的圆形电子围栏坐标、高德地理编码。只有合法且精确的坐标才写入，行政区域级或服务不可用时保留旧值/空值并提示人工确认。导入和既有数据回填均按地址缓存结果，避免同一地址重复请求。

路线基础档案只保留导入路线。Excel 导入的路线写入 `source: 导入路线`；运输订单产生的自动建档路线（`运输订单`、`运输订单自动建档`）不进入基础路线列表和路线选择器。兼容历史数据时，编号以 `HIS-` 开头的路线也视为运单派生数据，不展示并在数据清理时移除。已有运单仍保留自身的路线文本，不因基础档案过滤而改写历史业务记录。

## 替换 JSON store 的执行顺序

1. 审批中心：先替换 `approval_state`，因为其他业务都依赖审批状态。
2. 工资/组织：把 `oa_module_state.modules.org/salary` 拆到 `sys_* + hr_*`。
3. 运输基础资料和运输订单：先拆 `transport_vehicle/customer/route/order`。
4. 加油明细和 ETC：实现按车号 + 时间节点自动归集到订单。
5. 应收应付和现金：拆 `finance_*`，再让财务看板只做聚合查询。
6. 运营数据：改成后端聚合接口，前端只展示聚合结果和明细跳转。
   - 查询接口应支持财务年、财务月和车辆筛选，避免向浏览器下发全部历史明细。
   - 汇总结果与明细接口分离，车辆明细在用户点击时按需加载。
   - 油料数量按 `L` 与 `kg` 分开累计和展示，禁止将不同单位相加后标记为“混合单位”。
7. GPS、贸易、酒店：按独立模块逐步替换状态 JSON。

## API 改造规范

办公用车页面已经采用车辆主表一行一车的汇总结构，并通过 `/api/office-vehicle/batch-save` 一次保存车辆及多条费用、证照和保险；证照与保险有效期自动汇入首页统一到期预警，历史提醒字段仅作兼容。具体信息架构、事务与权限规则见 [办公用车汇总与录入规范](./office-vehicle-management.md)。

每个业务模块至少提供：

- `GET /api/<module>`：分页/筛选列表。
- `GET /api/<module>/<id>`：详情。
- `POST /api/<module>`：创建。
- `PUT /api/<module>/<id>`：更新。
- `DELETE /api/<module>/<id>`：软删除。
- 聚合页单独提供 `/summary` 或 `/overview`，不让前端拼复杂跨模块统计。

前端页面必须统一处理：

- loading：列表、详情、保存按钮分别有状态。
- empty：无数据时显示业务化空态。
- error：接口失败提示，并保留重试入口。
- optimistic update 只允许用于非关键字段，金额/审批状态必须以服务端返回为准。
- 汇总卡必须区分 `ready`、`empty` 和 `unavailable`；当前筛选无记录时不计算同比/环比下降。

### ETC 列表性能边界

- `/transport/etc` 使用独立的 `GET /api/transport/etc` 分页接口，不得通过 `/api/transport/operations/data` 下载完整运输数据集。
- 列表默认每页 20 条、单页最多 100 条；筛选、总数、总金额、车辆数和路线排行统一由 MySQL 按同一条件计算。
- 列表查询优先使用 `transport_etc_record` 的财务年、财务月、通行时间和状态结构化字段，`record_json` 仅负责兼容扩展字段。
- Excel、PDF 解析器仅在用户主动导入时加载；常规首屏不得加载 `xlsx`、`pdfjs` 或运输通用页面模块。
- 常规导出只导出当前页。未来若需要全量导出，应新增服务端异步导出任务，不允许恢复浏览器全量读取。

### 维保写入性能边界

- 维保新增、编辑、删除、批量导入及配件出入库必须使用 `/transport/maintenance/*` 模块接口，不得通过 `/transport/operations/data` 重写完整运输数据集。
- 配件出库与自动生成维保记录必须在同一服务端事务内完成；库存不足时两类记录均不得写入。
- 模块接口成功后，前端只更新维保或库存分区，并抑制旧版整批自动保存；运输聚合数据仍可按需后台刷新。
- 旧版 `/transport/operations/data` 仅保留给尚未拆分的运输模块，后续按本清单逐步收敛。

### 弹窗提交交互规范

- 所有产生服务端写入的弹窗必须绑定独立 `confirm-loading` 状态，并在提交期间禁用关闭按钮、Esc 和取消按钮。
- 提交函数必须阻止重复进入；成功提示在服务端确认写入且弹窗关闭后立即展示，列表或汇总刷新不得阻塞成功反馈。
- 保存失败时保留弹窗和用户输入，恢复可操作状态并展示明确错误；金额、审批状态和库存结果不得提前按成功处理。

## 本轮新增迁移

新增迁移文件：

- `deploy/mysql/migrations/20260709_001_business_schema.sql`

该迁移不会删除现有 `approval_state`, `oa_module_state`, `transport_operation_record`, `gps_state`，它们在迁移期作为兼容来源保留。后续完成页面替换并完成数据搬迁后，再单独做清理迁移。

## 云端部署要求

部署到云端时必须配置：

- `DB_CLIENT=mysql`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_REQUIRED=true`
- `JWT_SECRET`
- `SESSION_SECRET`

上线流程：

1. 安装依赖。
2. 执行 `pnpm migrate:mysql`，创建初始化表和业务迁移表。
3. 执行 `pnpm build`。
4. 执行 `pnpm start`。

`DB_REQUIRED=true` 或 `NODE_ENV=production` 时，后端数据库配置不完整会直接报错，不允许回退到 `storage/test-data`、`storage/runtime/json` 或内存数据。
