import type mysql from 'mysql2/promise'
import type { ActionPayload, ApprovalCc, ApprovalInstance, ApprovalLog, ApprovalNode, ApprovalStatus, ApprovalTask, ApprovalTemplate, BusinessRecord, BusinessStatus, SubmitApprovalPayload, TransferPayload, UpsertExternalApprovalPayload } from '../repositories/approval/types'
import { dispatchApprovalBusinessCallback } from './approval-callback-dispatcher'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { systemStore } from './system-store'
import './approval-business-store'
import './oa-module-store'

export type { ActionPayload, ApprovalAction, ApprovalCc, ApprovalInstance, ApprovalLog, ApprovalNode, ApprovalNodeTemplate, ApprovalStatus, ApprovalTask, ApprovalTemplate, BusinessRecord, BusinessStatus, SubmitApprovalPayload, TaskStatus, TransferPayload, UpsertExternalApprovalPayload } from '../repositories/approval/types'

const now = () => new Date().toISOString()

const users = new Map<string | number, string>([
  [1, '超级管理员'],
  [2, '普通用户'],
  [3, '财务经理'],
  [4, '部门负责人'],
  [5, '总经理'],
])

interface ApprovalMockState {
  seq: number
  templates: ApprovalTemplate[]
  instances: ApprovalInstance[]
  nodes: ApprovalNode[]
  tasks: ApprovalTask[]
  logs: ApprovalLog[]
  ccs: ApprovalCc[]
  messages: Array<Record<string, any>>
  businessRecords: BusinessRecord[]
}

declare global {
  // eslint-disable-next-line vars-on-top
  var __approvalMockState: ApprovalMockState | undefined
}

function createInitialState(): ApprovalMockState {
  return {
    seq: 1000,
    templates: [
      {
        id: 'tpl-expense',
        name: '费用/报销通用审批',
        businessTypes: ['expense', 'reimbursement', 'cash_expense', 'office_vehicle_expense', 'transport_fee', 'transport_fuel', 'transport_etc', 'transport_maintenance', 'vehicle_loan', 'payment', 'receivable', 'receipt', 'purchase'],
        enabled: true,
        nodes: [
          { id: 'node-manager', name: '部门负责人审批', order: 1, approverType: 'USER', approverIds: [4] },
          { id: 'node-finance', name: '财务复核', order: 2, approverType: 'USER', approverIds: [3] },
        ],
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: 'tpl-contract',
        name: '合同通用审批',
        businessTypes: ['contract', 'trade_contract', 'leave', 'overtime', 'travel', 'salary', 'attendance_adjustment', 'hr_change', 'inventory_adjustment', 'asset_purchase', 'asset_scrap', 'general'],
        enabled: true,
        nodes: [
          { id: 'node-legal', name: '合同初审', order: 1, approverType: 'USER', approverIds: [4] },
          { id: 'node-boss', name: '总经理审批', order: 2, approverType: 'USER', approverIds: [5] },
        ],
        createdAt: now(),
        updatedAt: now(),
      },
    ] as ApprovalTemplate[],
    instances: [] as ApprovalInstance[],
    nodes: [] as ApprovalNode[],
    tasks: [] as ApprovalTask[],
    logs: [] as ApprovalLog[],
    ccs: [] as ApprovalCc[],
    messages: [] as Array<Record<string, any>>,
    businessRecords: [] as BusinessRecord[],
  }
}

function createDatabaseInitialState(): ApprovalMockState {
  const initial = createInitialState()
  initial.templates = initial.templates.map(template => ({
    ...template,
    nodes: [{
      id: `${template.id}-admin`,
      name: '管理员审批',
      order: 1,
      approverType: 'USER',
      approverIds: [1],
    }],
  }))
  return initial
}

const state = globalThis.__approvalMockState ?? createInitialState()
globalThis.__approvalMockState = state
let hydrated = false

function nextId(prefix: string) {
  state.seq += 1
  return `${prefix}-${state.seq}`
}

function cloneState() {
  return JSON.parse(JSON.stringify(state))
}

function restoreState(snapshot: typeof state) {
  state.seq = snapshot.seq
  state.templates = snapshot.templates
  state.instances = snapshot.instances
  state.nodes = snapshot.nodes
  state.tasks = snapshot.tasks
  state.logs = snapshot.logs
  state.ccs = snapshot.ccs
  state.messages = snapshot.messages
  state.businessRecords = snapshot.businessRecords
}

async function ensureApprovalSchema(pool: mysql.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approval_template (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      business_types JSON NOT NULL,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_approval_template_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approval_cc (
      id VARCHAR(64) PRIMARY KEY,
      instance_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(128) NOT NULL,
      is_read TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_approval_cc_user (user_id, is_read),
      KEY idx_approval_cc_instance (instance_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approval_state (
      id VARCHAR(64) PRIMARY KEY,
      state_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null)
    return fallback
  if (typeof value === 'string')
    return JSON.parse(value) as T
  return value as T
}

function formatDbDate(value: unknown) {
  if (!value)
    return undefined
  if (value instanceof Date)
    return value.toISOString()
  return String(value)
}

function toDbDate(value: unknown) {
  if (!value)
    return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime()))
    return String(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function loadStructuredState(pool: mysql.Pool) {
  const [templateRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_template WHERE deleted_at IS NULL ORDER BY created_at ASC')
  const [templateNodeRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_template_node WHERE deleted_at IS NULL ORDER BY template_id ASC, order_no ASC')
  const [instanceRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_instance WHERE deleted_at IS NULL ORDER BY created_at ASC')
  const [nodeRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_node WHERE deleted_at IS NULL ORDER BY instance_id ASC, order_no ASC')
  const [taskRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_task WHERE deleted_at IS NULL ORDER BY created_at ASC')
  const [logRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_log ORDER BY created_at ASC')
  const [ccRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_cc ORDER BY created_at ASC')
  const [messageRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_message ORDER BY created_at ASC')
  const [businessRows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM approval_business_record ORDER BY updated_at ASC')

  const nodesByTemplate = new Map<string, ApprovalNodeTemplate[]>()
  templateNodeRows.forEach((row: any) => {
    const node: ApprovalNodeTemplate = {
      id: row.id,
      name: row.node_name,
      order: Number(row.order_no || 0),
      approverType: row.approver_type,
      approverIds: parseJsonValue(row.approver_ids, []),
    }
    const list = nodesByTemplate.get(row.template_id) || []
    list.push(node)
    nodesByTemplate.set(row.template_id, list)
  })

  const structuredState: ApprovalMockState = {
    seq: 1000,
    templates: templateRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      businessTypes: parseJsonValue(row.business_types, []),
      enabled: Boolean(row.enabled),
      nodes: nodesByTemplate.get(row.id) || [],
      createdAt: formatDbDate(row.created_at) || now(),
      updatedAt: formatDbDate(row.updated_at) || now(),
    })),
    instances: instanceRows.map((row: any) => ({
      id: row.id,
      code: row.code,
      templateId: row.template_id,
      approvalType: row.approval_type,
      businessModule: row.business_module || undefined,
      businessType: row.business_type,
      businessId: row.business_id,
      businessNo: row.business_no,
      title: row.title,
      applicantId: row.applicant_id,
      applicantName: row.applicant_name,
      deptId: row.dept_id || undefined,
      deptName: row.dept_name || undefined,
      amount: row.amount == null ? undefined : Number(row.amount),
      status: row.status,
      businessStatus: row.business_status,
      currentNodeId: row.current_node_id || undefined,
      currentNodeName: row.current_node_name || undefined,
      formSnapshot: parseJsonValue(row.form_snapshot, {}),
      payload: parseJsonValue(row.payload, {}),
      ccUserIds: parseJsonValue(row.cc_user_ids, []),
      createdAt: formatDbDate(row.created_at) || now(),
      updatedAt: formatDbDate(row.updated_at) || now(),
      submittedAt: formatDbDate(row.submitted_at) || now(),
      approvedAt: formatDbDate(row.approved_at),
      rejectedAt: formatDbDate(row.rejected_at),
      revokedAt: formatDbDate(row.revoked_at),
      businessAppliedAt: formatDbDate(row.business_applied_at),
    })),
    nodes: nodeRows.map((row: any) => ({
      id: row.id,
      instanceId: row.instance_id,
      templateNodeId: row.template_node_id,
      name: row.node_name,
      order: Number(row.order_no || 0),
      approverType: row.approver_type,
      approverIds: parseJsonValue(row.approver_ids, []),
      status: row.status,
    })),
    tasks: taskRows.map((row: any) => ({
      id: row.id,
      instanceId: row.instance_id,
      nodeId: row.node_id,
      nodeName: row.node_name,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_name,
      status: row.status,
      action: row.action || undefined,
      comment: row.comment || undefined,
      actedAt: formatDbDate(row.acted_at),
      createdAt: formatDbDate(row.created_at) || now(),
      updatedAt: formatDbDate(row.updated_at) || now(),
    })),
    logs: logRows.map((row: any) => ({
      id: row.id,
      instanceId: row.instance_id,
      taskId: row.task_id || undefined,
      action: row.action,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      comment: row.comment || undefined,
      fromUserId: row.from_user_id || undefined,
      toUserId: row.to_user_id || undefined,
      createdAt: formatDbDate(row.created_at) || now(),
    })),
    ccs: ccRows.map((row: any) => ({
      id: row.id,
      instanceId: row.instance_id,
      userId: row.user_id,
      userName: row.user_name,
      read: Boolean(row.is_read),
      createdAt: formatDbDate(row.created_at) || now(),
    })),
    messages: messageRows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      instanceId: row.instance_id,
      read: Boolean(row.is_read),
      createdAt: formatDbDate(row.created_at) || now(),
    })),
    businessRecords: businessRows.map((row: any) => ({
      businessType: row.business_type,
      businessId: row.business_id,
      businessNo: row.business_no,
      title: row.title,
      businessStatus: row.business_status,
      approvalStatus: row.approval_status || undefined,
      approvalInstanceId: row.approval_instance_id || undefined,
      updatedAt: formatDbDate(row.updated_at) || now(),
    })),
  }

  const numericIds = [
    ...structuredState.templates,
    ...templateNodeRows,
    ...structuredState.instances,
    ...structuredState.nodes,
    ...structuredState.tasks,
    ...structuredState.logs,
    ...structuredState.ccs,
    ...structuredState.messages,
  ]
    .map((item: any) => String(item.id || '').match(/(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
  structuredState.seq = Math.max(1000, ...numericIds)

  return {
    hasData: structuredState.templates.length > 0 || structuredState.instances.length > 0,
    state: structuredState,
  }
}

async function loadLegacyState(pool: mysql.Pool) {
  const [rows] = await pool.query<Array<mysql.RowDataPacket & { state_json: string | ApprovalMockState }>>(
    'SELECT state_json FROM approval_state WHERE id = ? LIMIT 1',
    ['default'],
  )
  if (!rows[0]?.state_json)
    return undefined
  return parseJsonValue(rows[0].state_json, createInitialState())
}

async function persistStructuredState(pool: mysql.Pool | mysql.PoolConnection) {
  await pool.query('DELETE FROM approval_message')
  await pool.query('DELETE FROM approval_cc')
  await pool.query('DELETE FROM approval_log')
  await pool.query('DELETE FROM approval_task')
  await pool.query('DELETE FROM approval_node')
  await pool.query('DELETE FROM approval_business_record')
  await pool.query('DELETE FROM approval_instance')
  await pool.query('DELETE FROM approval_template_node')
  await pool.query('DELETE FROM approval_template')

  for (const template of state.templates) {
    await pool.execute(`
      INSERT INTO approval_template (id, name, business_types, enabled, created_at, updated_at, deleted_at)
      VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, NULL)
    `, [template.id, template.name, JSON.stringify(template.businessTypes), template.enabled ? 1 : 0, toDbDate(template.createdAt), toDbDate(template.updatedAt)])
    for (const node of template.nodes) {
      await pool.execute(`
        INSERT INTO approval_template_node (id, template_id, node_name, order_no, approver_type, approver_ids, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), NOW(), NOW(), NULL)
      `, [node.id, template.id, node.name, node.order, node.approverType, JSON.stringify(node.approverIds)])
    }
  }

  for (const instance of state.instances) {
    await pool.execute(`
      INSERT INTO approval_instance (
        id, code, template_id, approval_type, business_module, business_type, business_id, business_no, title,
        applicant_id, applicant_name, dept_id, dept_name, amount, status, business_status, current_node_id,
        current_node_name, form_snapshot, payload, cc_user_ids, submitted_at, approved_at, rejected_at,
        revoked_at, business_applied_at, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, NULL)
    `, [
      instance.id,
      instance.code,
      instance.templateId,
      instance.approvalType,
      instance.businessModule || null,
      instance.businessType,
      instance.businessId,
      instance.businessNo,
      instance.title,
      String(instance.applicantId),
      instance.applicantName,
      instance.deptId == null ? null : String(instance.deptId),
      instance.deptName || null,
      instance.amount ?? null,
      instance.status,
      instance.businessStatus,
      instance.currentNodeId || null,
      instance.currentNodeName || null,
      JSON.stringify(instance.formSnapshot || {}),
      JSON.stringify(instance.payload || {}),
      JSON.stringify(instance.ccUserIds || []),
      toDbDate(instance.submittedAt),
      toDbDate(instance.approvedAt),
      toDbDate(instance.rejectedAt),
      toDbDate(instance.revokedAt),
      toDbDate(instance.businessAppliedAt),
      toDbDate(instance.createdAt),
      toDbDate(instance.updatedAt),
    ])
  }

  for (const node of state.nodes) {
    await pool.execute(`
      INSERT INTO approval_node (id, instance_id, template_node_id, node_name, order_no, approver_type, approver_ids, status, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, NOW(), NOW(), NULL)
    `, [node.id, node.instanceId, node.templateNodeId, node.name, node.order, node.approverType, JSON.stringify(node.approverIds), node.status])
  }

  for (const task of state.tasks) {
    await pool.execute(`
      INSERT INTO approval_task (id, instance_id, node_id, node_name, assignee_id, assignee_name, status, action, comment, acted_at, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `, [task.id, task.instanceId, task.nodeId, task.nodeName, String(task.assigneeId), task.assigneeName, task.status, task.action || null, task.comment || null, toDbDate(task.actedAt), toDbDate(task.createdAt), toDbDate(task.updatedAt)])
  }

  for (const log of state.logs) {
    await pool.execute(`
      INSERT INTO approval_log (id, instance_id, task_id, action, operator_id, operator_name, comment, from_user_id, to_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [log.id, log.instanceId, log.taskId || null, log.action, String(log.operatorId), log.operatorName, log.comment || null, log.fromUserId == null ? null : String(log.fromUserId), log.toUserId == null ? null : String(log.toUserId), toDbDate(log.createdAt)])
  }

  for (const cc of state.ccs) {
    await pool.execute(`
      INSERT INTO approval_cc (id, instance_id, user_id, user_name, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cc.id, cc.instanceId, String(cc.userId), cc.userName, cc.read ? 1 : 0, toDbDate(cc.createdAt)])
  }

  for (const message of state.messages) {
    await pool.execute(`
      INSERT INTO approval_message (id, user_id, title, content, instance_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [message.id, String(message.userId), message.title, message.content, message.instanceId, message.read ? 1 : 0, toDbDate(message.createdAt)])
  }

  for (const record of state.businessRecords) {
    await pool.execute(`
      INSERT INTO approval_business_record (business_type, business_id, business_no, title, business_status, approval_status, approval_instance_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [record.businessType, record.businessId, record.businessNo, record.title, record.businessStatus, record.approvalStatus || null, record.approvalInstanceId || null, toDbDate(record.updatedAt)])
  }
}

async function hydrateState() {
  if (hydrated)
    return

  const pool = getMysqlPool()
  if (!pool) {
    hydrated = true
    return
  }

  await ensureApprovalSchema(pool)
  const structured = await loadStructuredState(pool)
  let needsPersist = false
  if (structured.hasData) {
    restoreState(structured.state)
    if (!state.templates.length) {
      state.templates = createDatabaseInitialState().templates
      needsPersist = true
    }
  }
  else {
    const legacyState = await loadLegacyState(pool)
    if (legacyState)
      restoreState(legacyState)
    else if (isDatabaseRequired())
      restoreState(createDatabaseInitialState())
    needsPersist = true
  }
  if (needsPersist)
    await withMysqlTransaction(pool, connection => persistStructuredState(connection))
  hydrated = true
}

async function persistState() {
  const pool = getMysqlPool()
  if (!pool)
    return

  await ensureApprovalSchema(pool)
  await withMysqlTransaction(pool, connection => persistStructuredState(connection))
}

async function transaction<T>(handler: () => T | Promise<T>): Promise<T> {
  await hydrateState()
  const snapshot = cloneState()
  try {
    const result = await handler()
    await persistState()
    return result
  }
  catch (error) {
    restoreState(snapshot)
    throw error
  }
}

function getUserName(userId: string | number) {
  return users.get(userId) ?? `用户${userId}`
}

async function syncUserDirectory() {
  const userList = await systemStore.listUsers({ status: 'enabled' })
  users.clear()
  userList.forEach((item) => {
    users.set(item.id, item.nickname)
  })
  return userList
}

function assertApproverIds(approverIds: Array<string | number>, validUsers: Array<{ id: string | number }>) {
  if (!approverIds.length)
    throw new Error('请至少选择一名审批人员')

  const validIds = new Set(validUsers.map(item => String(item.id)))
  if (approverIds.some(id => !validIds.has(String(id))))
    throw new Error('审批人员必须来自组织架构中的在职人员')
}

function assertCcUserIds(userIds: Array<string | number>, validUsers: Array<{ id: string | number }>) {
  const validIds = new Set(validUsers.map(item => String(item.id)))
  if (userIds.some(id => !validIds.has(String(id))))
    throw new Error('抄送人员必须来自组织架构中的在职人员')
}

function getTemplateForBusiness(businessType: string, templateId?: string) {
  const template = templateId
    ? state.templates.find(item => item.id === templateId && item.enabled)
    : state.templates.find(item => item.enabled && item.businessTypes.includes(businessType))

  if (!template)
    throw new Error(`未找到适用于 ${businessType} 的审批模板`)
  return template
}

function getInstanceSync(id: string) {
  const instance = state.instances.find(item => item.id === id)
  if (!instance)
    throw new Error('审批实例不存在')
  return instance
}

function getTaskSync(id: string) {
  const task = state.tasks.find(item => item.id === id)
  if (!task)
    throw new Error('审批任务不存在')
  return task
}

function getDetailSync(instanceId: string) {
  const instance = getInstanceSync(instanceId)
  return {
    instance,
    nodes: state.nodes.filter(item => item.instanceId === instanceId).sort((a, b) => a.order - b.order),
    tasks: state.tasks.filter(item => item.instanceId === instanceId),
    logs: state.logs.filter(item => item.instanceId === instanceId),
    ccs: state.ccs.filter(item => item.instanceId === instanceId),
    business: state.businessRecords.find(item => item.approvalInstanceId === instanceId),
  }
}

function assertNoActiveApproval(businessType: string, businessId: string) {
  const active = state.instances.find(item =>
    item.businessType === businessType
    && item.businessId === businessId
    && ['PENDING', 'APPROVING'].includes(item.status),
  )
  if (active)
    throw new Error(`业务单据 ${active.businessNo} 已存在审批中流程`)
}

function assertTaskOperator(task: ApprovalTask, operatorId: string | number) {
  if (String(task.assigneeId) !== String(operatorId))
    throw new Error('仅当前审批人可操作该任务')
}

function addLog(input: Omit<ApprovalLog, 'id' | 'createdAt'>) {
  const log = {
    id: nextId('log'),
    createdAt: now(),
    ...input,
  }
  state.logs.push(log)
  return log
}

function addMessage(userId: string | number, title: string, content: string, instanceId: string) {
  state.messages.push({
    id: nextId('msg'),
    userId,
    title,
    content,
    instanceId,
    read: false,
    createdAt: now(),
  })
}

function upsertBusiness(instance: ApprovalInstance, businessStatus: BusinessStatus) {
  let record = state.businessRecords.find(item =>
    item.businessType === instance.businessType && item.businessId === instance.businessId,
  )
  if (!record) {
    record = {
      businessType: instance.businessType,
      businessId: instance.businessId,
      businessNo: instance.businessNo,
      title: instance.title,
      businessStatus,
      updatedAt: now(),
    }
    state.businessRecords.push(record)
  }
  record.businessStatus = businessStatus
  record.approvalStatus = instance.status
  record.approvalInstanceId = instance.id
  record.updatedAt = now()
}

function createTasksForNode(instance: ApprovalInstance, node: ApprovalNode) {
  for (const assigneeId of node.approverIds) {
    state.tasks.push({
      id: nextId('task'),
      instanceId: instance.id,
      nodeId: node.id,
      nodeName: node.name,
      assigneeId,
      assigneeName: getUserName(assigneeId),
      status: 'PENDING',
      createdAt: now(),
      updatedAt: now(),
    })
    addMessage(assigneeId, '待办审批', `${instance.title} 等待你审批`, instance.id)
  }
}

function isInRightOpenDateRange(value: string | undefined, query: Record<string, any> = {}) {
  if (!query.startDate || !query.endDate)
    return true
  if (!value)
    return false

  const time = new Date(value).getTime()
  return time >= new Date(`${query.startDate}T00:00:00`).getTime()
    && time < new Date(`${query.endDate}T00:00:00`).getTime()
}

function isInstanceInPeriod(instance: ApprovalInstance, query: Record<string, any> = {}) {
  return isInRightOpenDateRange(instance.submittedAt || instance.createdAt, query)
}

async function moveToNextNode(instance: ApprovalInstance, currentNode: ApprovalNode) {
  currentNode.status = 'APPROVED'
  const nextNode = state.nodes
    .filter(item => item.instanceId === instance.id)
    .sort((a, b) => a.order - b.order)
    .find(item => item.order > currentNode.order)

  if (!nextNode) {
    instance.status = 'APPROVED'
    instance.businessStatus = 'APPROVAL_APPROVED'
    instance.currentNodeId = undefined
    instance.currentNodeName = undefined
    instance.approvedAt = now()
    upsertBusiness(instance, 'APPROVAL_APPROVED')
    await dispatchApprovalBusinessCallback('approved', instance)
    instance.businessAppliedAt = now()
    addMessage(instance.applicantId, '审批通过', `${instance.title} 已审批通过`, instance.id)
    return
  }

  nextNode.status = 'PENDING'
  instance.status = 'APPROVING'
  instance.currentNodeId = nextNode.id
  instance.currentNodeName = nextNode.name
  createTasksForNode(instance, nextNode)
  upsertBusiness(instance, 'APPROVAL_PENDING')
}

export const approvalStore = {
  users,
  async listTemplates() {
    await hydrateState()
    return state.templates
  },
  async createTemplate(payload: Pick<ApprovalTemplate, 'name' | 'businessTypes' | 'nodes'>) {
    return transaction(async () => {
      const validUsers = await syncUserDirectory()
      payload.nodes.forEach(node => assertApproverIds(node.approverIds ?? [], validUsers))
      const template: ApprovalTemplate = {
        id: nextId('tpl'),
        name: payload.name,
        businessTypes: payload.businessTypes,
        enabled: true,
        nodes: payload.nodes.map((node, index) => ({
          ...node,
          id: node.id || nextId('tpl-node'),
          order: node.order ?? index + 1,
        })),
        createdAt: now(),
        updatedAt: now(),
      }
      state.templates.push(template)
      return template
    })
  },
  async submit(payload: SubmitApprovalPayload) {
    return transaction(async () => {
      const validUsers = await syncUserDirectory()
      assertNoActiveApproval(payload.businessType, payload.businessId)
      const template = getTemplateForBusiness(payload.businessType, payload.templateId)
      template.nodes.forEach(node => assertApproverIds(node.approverIds ?? [], validUsers))
      assertCcUserIds(payload.ccUserIds ?? [], validUsers)
      const sortedNodes = [...template.nodes].sort((a, b) => a.order - b.order)
      const firstNode = sortedNodes[0]
      if (!firstNode)
        throw new Error('审批模板未配置审批节点')

      const instance: ApprovalInstance = {
        id: nextId('apv'),
        code: `APV${Date.now()}`,
        templateId: template.id,
        approvalType: payload.approvalType || payload.businessType,
        businessModule: payload.businessModule || payload.formData?.moduleName || payload.formData?.modulePath,
        businessType: payload.businessType,
        businessId: payload.businessId,
        businessNo: payload.businessNo,
        title: payload.title,
        applicantId: payload.applicantId,
        applicantName: payload.applicantName,
        deptId: payload.deptId,
        deptName: payload.deptName,
        amount: payload.amount,
        status: 'PENDING',
        businessStatus: 'APPROVAL_PENDING',
        formSnapshot: payload.formData ?? {},
        payload: payload.formData ?? {},
        ccUserIds: payload.ccUserIds ?? [],
        createdAt: now(),
        updatedAt: now(),
        submittedAt: now(),
      }
      state.instances.push(instance)

      const nodes = sortedNodes.map((node) => {
        const approvalNode: ApprovalNode = {
          id: nextId('node'),
          instanceId: instance.id,
          templateNodeId: node.id,
          name: node.name,
          order: node.order,
          approverType: node.approverType,
          approverIds: node.approverIds,
          status: node.id === firstNode.id ? 'PENDING' : 'PENDING',
        }
        state.nodes.push(approvalNode)
        return approvalNode
      })

      const currentNode = nodes[0]
      instance.currentNodeId = currentNode.id
      instance.currentNodeName = currentNode.name
      createTasksForNode(instance, currentNode)

      for (const userId of instance.ccUserIds) {
        state.ccs.push({
          id: nextId('cc'),
          instanceId: instance.id,
          userId,
          userName: getUserName(userId),
          read: false,
          createdAt: now(),
        })
        addLog({
          instanceId: instance.id,
          action: 'CC',
          operatorId: payload.applicantId,
          operatorName: payload.applicantName,
          toUserId: userId,
          comment: `抄送给${getUserName(userId)}`,
        })
        addMessage(userId, '审批抄送', `${instance.title} 抄送给你`, instance.id)
      }

      addLog({
        instanceId: instance.id,
        action: 'SUBMIT',
        operatorId: payload.applicantId,
        operatorName: payload.applicantName,
        comment: '提交审批',
      })
      upsertBusiness(instance, 'APPROVAL_PENDING')
      await dispatchApprovalBusinessCallback('pending', instance)
      return getDetailSync(instance.id)
    })
  },
  async upsertExternal(payload: UpsertExternalApprovalPayload) {
    return transaction(async () => {
      const businessId = `WECOM-${payload.externalKey}`
      let instance = state.instances.find(item => item.businessId === businessId)
      const timestamp = now()
      const businessStatus: BusinessStatus = payload.status === 'APPROVED'
        ? 'APPROVAL_APPROVED'
        : payload.status === 'REJECTED'
          ? 'APPROVAL_REJECTED'
          : ['REVOKED', 'CANCELED'].includes(payload.status)
              ? 'APPROVAL_REVOKED'
              : 'APPROVAL_PENDING'

      if (!instance) {
        instance = {
          id: nextId('apv'),
          code: payload.externalKey,
          templateId: '',
          approvalType: payload.approvalType,
          businessModule: '审批中心',
          businessType: payload.businessType,
          businessId,
          businessNo: payload.businessNo,
          title: payload.title,
          applicantId: payload.applicantId,
          applicantName: payload.applicantName,
          deptId: payload.deptId,
          deptName: payload.deptName,
          amount: payload.amount,
          status: payload.status,
          businessStatus,
          formSnapshot: payload.formData,
          payload: payload.formData,
          ccUserIds: payload.ccUserIds ?? [],
          createdAt: payload.submittedAt,
          updatedAt: timestamp,
          submittedAt: payload.submittedAt,
        }
        state.instances.push(instance)
      }
      else {
        const archiveMetadata = instance.payload?.archivedAt
          ? {
              archivedAt: instance.payload.archivedAt,
              archivedBy: instance.payload.archivedBy,
              archivedById: instance.payload.archivedById,
              archiveReason: instance.payload.archiveReason,
            }
          : {}
        Object.assign(instance, {
          approvalType: payload.approvalType,
          businessType: payload.businessType,
          businessNo: payload.businessNo,
          title: payload.title,
          applicantId: payload.applicantId,
          applicantName: payload.applicantName,
          deptId: payload.deptId,
          deptName: payload.deptName,
          amount: payload.amount,
          status: payload.status,
          businessStatus,
          formSnapshot: payload.formData,
          payload: { ...payload.formData, ...archiveMetadata },
          ccUserIds: payload.ccUserIds ?? [],
          updatedAt: timestamp,
          submittedAt: payload.submittedAt,
        })
      }

      instance.approvedAt = payload.status === 'APPROVED' ? payload.completedAt || timestamp : undefined
      instance.rejectedAt = payload.status === 'REJECTED' ? payload.completedAt || timestamp : undefined
      instance.revokedAt = ['REVOKED', 'CANCELED'].includes(payload.status) ? payload.completedAt || timestamp : undefined
      instance.businessAppliedAt = payload.status === 'APPROVED' ? payload.completedAt || timestamp : undefined
      instance.currentNodeId = undefined
      instance.currentNodeName = undefined
      upsertBusiness(instance, businessStatus)
      state.logs = state.logs.filter(log => !(log.instanceId === instance!.id && log.action === 'EXTERNAL_SYNC' && log.comment?.includes(payload.externalKey)))
      const externalStatusText: Record<string, string> = { PENDING: '待审批', APPROVING: '审批中', APPROVED: '已通过', REJECTED: '已驳回', REVOKED: '已撤回', CANCELED: '已取消' }
      addLog({
        instanceId: instance.id,
        action: 'EXTERNAL_SYNC',
        operatorId: '企业微信',
        operatorName: '企业微信',
        comment: `企业微信审批同步：${externalStatusText[payload.status] || payload.status}（${payload.externalKey}）`,
      })
      if (payload.status === 'APPROVED')
        await dispatchApprovalBusinessCallback('approved', instance)
      else if (payload.status === 'REJECTED')
        await dispatchApprovalBusinessCallback('rejected', instance)
      else if (['REVOKED', 'CANCELED'].includes(payload.status))
        await dispatchApprovalBusinessCallback('revoked', instance)
      else
        await dispatchApprovalBusinessCallback('pending', instance)
      return getDetailSync(instance.id)
    })
  },
  async approve(payload: ActionPayload) {
    return transaction(async () => {
      const task = getTaskSync(payload.taskId)
      const instance = getInstanceSync(task.instanceId)
      if (task.status !== 'PENDING')
        throw new Error('当前任务不可审批')
      assertTaskOperator(task, payload.operatorId)
      task.status = 'APPROVED'
      task.action = 'APPROVE'
      task.comment = payload.comment
      task.actedAt = now()
      task.updatedAt = now()
      instance.updatedAt = now()
      addLog({ instanceId: instance.id, taskId: task.id, action: 'APPROVE', operatorId: payload.operatorId, operatorName: payload.operatorName, comment: payload.comment })

      const currentNode = state.nodes.find(item => item.id === task.nodeId)
      if (!currentNode)
        throw new Error('审批节点不存在')

      const pendingTasks = state.tasks.filter(item => item.instanceId === instance.id && item.nodeId === task.nodeId && item.status === 'PENDING')
      if (pendingTasks.length === 0)
        await moveToNextNode(instance, currentNode)

      return getDetailSync(instance.id)
    })
  },
  async reject(payload: ActionPayload) {
    return transaction(async () => {
      const task = getTaskSync(payload.taskId)
      const instance = getInstanceSync(task.instanceId)
      if (task.status !== 'PENDING')
        throw new Error('当前任务不可驳回')
      assertTaskOperator(task, payload.operatorId)
      task.status = 'REJECTED'
      task.action = 'REJECT'
      task.comment = payload.comment
      task.actedAt = now()
      task.updatedAt = now()
      state.tasks
        .filter(item => item.instanceId === instance.id && item.status === 'PENDING')
        .forEach((item) => {
          item.status = 'CANCELED'
          item.updatedAt = now()
        })
      instance.status = 'REJECTED'
      instance.businessStatus = 'APPROVAL_REJECTED'
      instance.rejectedAt = now()
      instance.updatedAt = now()
      addLog({ instanceId: instance.id, taskId: task.id, action: 'REJECT', operatorId: payload.operatorId, operatorName: payload.operatorName, comment: payload.comment })
      upsertBusiness(instance, 'APPROVAL_REJECTED')
      await dispatchApprovalBusinessCallback('rejected', instance)
      addMessage(instance.applicantId, '审批驳回', `${instance.title} 已被驳回`, instance.id)
      return getDetailSync(instance.id)
    })
  },
  async revoke(instanceId: string, operatorId: string | number, operatorName: string, comment?: string) {
    return transaction(async () => {
      const instance = getInstanceSync(instanceId)
      if (!['PENDING', 'APPROVING'].includes(instance.status))
        throw new Error('当前审批不可撤回')
      if (String(instance.applicantId) !== String(operatorId))
        throw new Error('仅申请人可撤回审批')
      state.tasks
        .filter(item => item.instanceId === instance.id && item.status === 'PENDING')
        .forEach((item) => {
          item.status = 'CANCELED'
          item.updatedAt = now()
        })
      instance.status = 'REVOKED'
      instance.businessStatus = 'APPROVAL_REVOKED'
      instance.revokedAt = now()
      instance.updatedAt = now()
      addLog({ instanceId: instance.id, action: 'REVOKE', operatorId, operatorName, comment })
      upsertBusiness(instance, 'APPROVAL_REVOKED')
      await dispatchApprovalBusinessCallback('revoked', instance)
      return getDetailSync(instance.id)
    })
  },
  async archive(instanceId: string, operatorId: string | number, operatorName: string, reason?: string) {
    return transaction(async () => {
      const instance = getInstanceSync(instanceId)
      if (instance.payload?.archivedAt)
        throw new Error('该审批已经删除或归档')

      if (['PENDING', 'APPROVING'].includes(instance.status)) {
        state.tasks
          .filter(item => item.instanceId === instance.id && item.status === 'PENDING')
          .forEach((item) => {
            item.status = 'CANCELED'
            item.updatedAt = now()
          })
        instance.status = 'REVOKED'
        instance.businessStatus = 'APPROVAL_REVOKED'
        instance.revokedAt = now()
        await dispatchApprovalBusinessCallback('revoked', instance)
        upsertBusiness(instance, 'APPROVAL_REVOKED')
      }

      instance.payload = {
        ...(instance.payload || {}),
        archivedAt: now(),
        archivedBy: operatorName,
        archivedById: operatorId,
        archiveReason: String(reason || '管理员删除'),
      }
      instance.updatedAt = now()
      addLog({
        instanceId: instance.id,
        action: 'ARCHIVE',
        operatorId,
        operatorName,
        comment: String(reason || '管理员删除'),
      })
      return getDetailSync(instance.id)
    })
  },
  async transfer(payload: TransferPayload) {
    return transaction(async () => {
      const validUsers = await syncUserDirectory()
      const task = getTaskSync(payload.taskId)
      const instance = getInstanceSync(task.instanceId)
      if (task.status !== 'PENDING')
        throw new Error('当前任务不可转交')
      assertTaskOperator(task, payload.operatorId)
      const validIds = new Set(validUsers.map(item => String(item.id)))
      if (!validIds.has(String(payload.toUserId)))
        throw new Error('转交人员必须来自组织架构中的在职人员')
      task.status = 'TRANSFERRED'
      task.action = 'TRANSFER'
      task.comment = payload.comment
      task.actedAt = now()
      task.updatedAt = now()
      const newTask: ApprovalTask = {
        id: nextId('task'),
        instanceId: task.instanceId,
        nodeId: task.nodeId,
        nodeName: task.nodeName,
        assigneeId: payload.toUserId,
        assigneeName: getUserName(payload.toUserId),
        status: 'PENDING',
        createdAt: now(),
        updatedAt: now(),
      }
      state.tasks.push(newTask)
      addLog({
        instanceId: instance.id,
        taskId: task.id,
        action: 'TRANSFER',
        operatorId: payload.operatorId,
        operatorName: payload.operatorName,
        comment: payload.comment,
        fromUserId: payload.operatorId,
        toUserId: payload.toUserId,
      })
      addMessage(payload.toUserId, '审批转交', `${instance.title} 已转交给你审批`, instance.id)
      return getDetailSync(instance.id)
    })
  },
  async getInstance(id: string) {
    await hydrateState()
    return getInstanceSync(id)
  },
  async getTask(id: string) {
    await hydrateState()
    return getTaskSync(id)
  },
  async listInstances(query: Record<string, any> = {}) {
    await hydrateState()
    return state.instances.filter((item) => {
      if (!query.includeArchived && item.payload?.archivedAt)
        return false
      if (query.status && item.status !== query.status)
        return false
      if (query.businessType && item.businessType !== query.businessType)
        return false
      if (!isInstanceInPeriod(item, query))
        return false
      return true
    })
  },
  async listTodo(userId: string | number, query: Record<string, any> = {}) {
    await hydrateState()
    return state.tasks
      .filter(item => String(item.assigneeId) === String(userId) && item.status === 'PENDING')
      .map(task => ({ ...task, instance: getInstanceSync(task.instanceId) }))
      .filter(task => isInstanceInPeriod(task.instance, query))
  },
  async listDone(userId: string | number, query: Record<string, any> = {}) {
    await hydrateState()
    return state.tasks
      .filter(item => String(item.assigneeId) === String(userId) && item.status !== 'PENDING')
      .map(task => ({ ...task, instance: getInstanceSync(task.instanceId) }))
      .filter(task => !task.instance.payload?.archivedAt && isInstanceInPeriod(task.instance, query))
  },
  async listSubmitted(userId: string | number, query: Record<string, any> = {}) {
    await hydrateState()
    return state.instances.filter(item => !item.payload?.archivedAt && String(item.applicantId) === String(userId) && isInstanceInPeriod(item, query))
  },
  async listCc(userId: string | number, query: Record<string, any> = {}) {
    await hydrateState()
    return state.ccs
      .filter(item => String(item.userId) === String(userId))
      .map(cc => ({ ...cc, instance: getInstanceSync(cc.instanceId) }))
      .filter(cc => !cc.instance.payload?.archivedAt && isInstanceInPeriod(cc.instance, query))
  },
  async getDetail(instanceId: string) {
    await hydrateState()
    return getDetailSync(instanceId)
  },
  async canUserViewInstance(instanceId: string, userId: string | number) {
    await hydrateState()
    const instance = getInstanceSync(instanceId)
    return String(instance.applicantId) === String(userId)
      || state.tasks.some(item => item.instanceId === instanceId && String(item.assigneeId) === String(userId))
      || state.ccs.some(item => item.instanceId === instanceId && String(item.userId) === String(userId))
  },
  async getByBusiness(businessType: string, businessId: string) {
    await hydrateState()
    const instance = state.instances.find(item => item.businessType === businessType && item.businessId === businessId && !item.payload?.archivedAt)
    return instance ? getDetailSync(instance.id) : null
  },
  async applyExternalStatus(instanceId: string, status: ApprovalStatus, source: string, reference: string, formData?: Record<string, any>) {
    return transaction(async () => {
      const instance = getInstanceSync(instanceId)
      const allowed: ApprovalStatus[] = ['PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'REVOKED', 'CANCELED']
      if (!allowed.includes(status))
        throw new Error('外部审批状态不受支持')

      instance.status = status
      instance.updatedAt = now()
      if (formData) {
        const archiveMetadata = instance.payload?.archivedAt
          ? {
              archivedAt: instance.payload.archivedAt,
              archivedBy: instance.payload.archivedBy,
              archivedById: instance.payload.archivedById,
              archiveReason: instance.payload.archiveReason,
            }
          : {}
        instance.formSnapshot = formData
        instance.payload = { ...formData, ...archiveMetadata }
      }
      if (status === 'APPROVED') {
        instance.businessStatus = 'APPROVAL_APPROVED'
        instance.approvedAt = now()
        instance.currentNodeId = undefined
        instance.currentNodeName = undefined
        await dispatchApprovalBusinessCallback('approved', instance)
        instance.businessAppliedAt = now()
      }
      else if (status === 'REJECTED') {
        instance.businessStatus = 'APPROVAL_REJECTED'
        instance.rejectedAt = now()
        await dispatchApprovalBusinessCallback('rejected', instance)
      }
      else if (status === 'REVOKED' || status === 'CANCELED') {
        instance.businessStatus = 'APPROVAL_REVOKED'
        instance.revokedAt = now()
        await dispatchApprovalBusinessCallback('revoked', instance)
      }
      else {
        instance.businessStatus = 'APPROVAL_PENDING'
        await dispatchApprovalBusinessCallback('pending', instance)
      }

      if (!['PENDING', 'APPROVING'].includes(status)) {
        state.tasks
          .filter(item => item.instanceId === instance.id && item.status === 'PENDING')
          .forEach((item) => {
            item.status = 'CANCELED'
            item.updatedAt = now()
          })
      }
      addLog({
        instanceId: instance.id,
        action: 'EXTERNAL_SYNC',
        operatorId: source,
        operatorName: source,
        comment: `${source}状态同步：${status}（${reference}）`,
      })
      upsertBusiness(instance, instance.businessStatus)
      return getDetailSync(instance.id)
    })
  },
  async listBusinessRecords(query: Record<string, any> = {}) {
    await hydrateState()
    const archivedIds = new Set(state.instances.filter(item => item.payload?.archivedAt).map(item => item.id))
    return state.businessRecords.filter(item => !archivedIds.has(String(item.approvalInstanceId || '')) && isInRightOpenDateRange(item.updatedAt, query))
  },
  async resetForTest() {
    await hydrateState()
    state.instances = []
    state.nodes = []
    state.tasks = []
    state.logs = []
    state.ccs = []
    state.messages = []
    state.businessRecords = []
    await persistState()
  },
}
