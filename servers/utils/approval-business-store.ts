import type mysql from 'mysql2/promise'
import type { ApprovalInstance } from './approval-store'
import dayjs from 'dayjs'
import { registerApprovalBusinessHandler } from './approval-callback-dispatcher'
import { getMysqlPool, isDatabaseRequired } from './mysql'

type GenericBusinessStatus = '审批中' | '已通过' | '已驳回' | '已撤回'

interface GenericBusinessRecord {
  id: string
  approvalInstanceId: string
  businessType: string
  businessModule?: string
  businessId: string
  businessNo: string
  title: string
  status: GenericBusinessStatus
  amount?: number
  payload: Record<string, any>
  applied: boolean
  appliedAt?: string
  createdAt: string
  updatedAt: string
}

interface CashAccount {
  id: string
  name: string
  balance: number
}

interface CashFlow {
  id: string
  approvalInstanceId: string
  accountId: string
  flowType: '支出' | '收入'
  amount: number
  title: string
  createdAt: string
}

interface LeaveBalance {
  employeeId: string | number
  annualLeaveDays: number
  usedLeaveDays: number
}

interface ApprovalBusinessState {
  records: GenericBusinessRecord[]
  cashAccounts: CashAccount[]
  cashFlows: CashFlow[]
  leaveBalances: LeaveBalance[]
  seq: number
}

const globalStore = globalThis as typeof globalThis & { __approvalBusinessState?: ApprovalBusinessState }
const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss')

function createInitialState(): ApprovalBusinessState {
  return {
    seq: 1000,
    records: [],
    cashAccounts: isDatabaseRequired() ? [] : [{ id: 'cash-default', name: '默认现金账户', balance: 30000 }],
    cashFlows: [],
    leaveBalances: [],
  }
}

const state = globalStore.__approvalBusinessState ?? createInitialState()
globalStore.__approvalBusinessState = state
let hydrated = false

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null)
    return fallback
  if (typeof value === 'string')
    return JSON.parse(value) as T
  return value as T
}

async function ensureApprovalBusinessSchema(db: mysql.Pool) {
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS approval_cash_account (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS approval_leave_balance (
      employee_id VARCHAR(64) PRIMARY KEY,
      annual_leave_days DECIMAL(8, 2) NOT NULL DEFAULT 0,
      used_leave_days DECIMAL(8, 2) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function hydrateApprovalBusinessState() {
  if (hydrated)
    return

  const db = getMysqlPool()
  if (!db) {
    hydrated = true
    return
  }
  await ensureApprovalBusinessSchema(db)

  const [recordRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM approval_generic_business_record WHERE deleted_at IS NULL ORDER BY created_at ASC')
  const [accountRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM approval_cash_account ORDER BY id ASC')
  const [flowRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM approval_cash_flow ORDER BY created_at ASC')
  const [leaveRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM approval_leave_balance ORDER BY employee_id ASC')

  if (recordRows.length || accountRows.length || flowRows.length || leaveRows.length) {
    state.records = recordRows.map((row: any) => ({
      id: String(row.id),
      approvalInstanceId: row.approval_instance_id,
      businessType: row.business_type,
      businessModule: row.business_module || undefined,
      businessId: row.business_id,
      businessNo: row.business_no || '',
      title: row.title,
      status: row.business_status,
      amount: row.amount == null ? undefined : Number(row.amount),
      payload: parseJson(row.payload, {}),
      applied: Boolean(row.applied),
      appliedAt: row.applied_at ? dayjs(row.applied_at).format('YYYY-MM-DD HH:mm:ss') : undefined,
      createdAt: dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs(row.updated_at).format('YYYY-MM-DD HH:mm:ss'),
    }))
    state.cashAccounts = accountRows.map((row: any) => ({ id: String(row.id), name: row.name, balance: Number(row.balance || 0) }))
    state.cashFlows = flowRows.map((row: any) => ({
      id: String(row.id),
      approvalInstanceId: row.approval_instance_id,
      accountId: row.account_id,
      flowType: row.flow_type,
      amount: Number(row.amount || 0),
      title: row.title,
      createdAt: dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
    }))
    state.leaveBalances = leaveRows.map((row: any) => ({
      employeeId: row.employee_id,
      annualLeaveDays: Number(row.annual_leave_days || 0),
      usedLeaveDays: Number(row.used_leave_days || 0),
    }))
    state.seq = Math.max(1000, ...[
      ...state.records,
      ...state.cashFlows,
    ].map(item => Number(String(item.id).match(/\d+$/)?.[0] || 0)))
    hydrated = true
    return
  }

  hydrated = true

  if (!isDatabaseRequired())
    await persistApprovalBusinessState()
}

async function persistApprovalBusinessState() {
  await hydrateApprovalBusinessState()
  const db = getMysqlPool()
  if (!db)
    return
  await ensureApprovalBusinessSchema(db)
  await db.execute('UPDATE approval_generic_business_record SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('DELETE FROM approval_cash_account')
  await db.execute('DELETE FROM approval_cash_flow')
  await db.execute('DELETE FROM approval_leave_balance')

  for (const record of state.records) {
    await db.execute(`
      INSERT INTO approval_generic_business_record (
        id, approval_instance_id, business_type, business_module, business_id, business_no,
        title, business_status, amount, payload, applied, applied_at, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE business_status = VALUES(business_status), payload = VALUES(payload), applied = VALUES(applied), applied_at = VALUES(applied_at), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [
      record.id,
      record.approvalInstanceId,
      record.businessType,
      record.businessModule || null,
      record.businessId,
      record.businessNo,
      record.title,
      record.status,
      record.amount ?? null,
      JSON.stringify(record.payload || {}),
      record.applied ? 1 : 0,
      record.appliedAt || null,
      record.createdAt,
      record.updatedAt,
    ])
  }
  for (const account of state.cashAccounts)
    await db.execute('INSERT INTO approval_cash_account (id, name, balance) VALUES (?, ?, ?)', [account.id, account.name, account.balance])
  for (const flow of state.cashFlows)
    await db.execute('INSERT INTO approval_cash_flow (id, approval_instance_id, account_id, flow_type, amount, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [flow.id, flow.approvalInstanceId, flow.accountId, flow.flowType, flow.amount, flow.title, flow.createdAt])
  for (const balance of state.leaveBalances)
    await db.execute('INSERT INTO approval_leave_balance (employee_id, annual_leave_days, used_leave_days) VALUES (?, ?, ?)', [String(balance.employeeId), balance.annualLeaveDays, balance.usedLeaveDays])
}

function snapshot() {
  return JSON.parse(JSON.stringify(state))
}

function restore(snapshotValue: unknown) {
  const source = snapshotValue as ApprovalBusinessState
  state.seq = source.seq
  state.records = source.records
  state.cashAccounts = source.cashAccounts
  state.cashFlows = source.cashFlows
  state.leaveBalances = source.leaveBalances
  void persistApprovalBusinessState()
}

function nextId(prefix: string) {
  state.seq += 1
  return `${prefix}${state.seq}`
}

function upsertRecord(instance: ApprovalInstance, status: GenericBusinessStatus) {
  let record = state.records.find(item => item.approvalInstanceId === instance.id)
  if (!record) {
    record = {
      id: nextId('biz'),
      approvalInstanceId: instance.id,
      businessType: instance.businessType,
      businessModule: instance.businessModule,
      businessId: instance.businessId,
      businessNo: instance.businessNo,
      title: instance.title,
      status,
      amount: instance.amount,
      payload: instance.payload || instance.formSnapshot || {},
      applied: false,
      createdAt: now(),
      updatedAt: now(),
    }
    state.records.push(record)
  }
  record.status = status
  record.updatedAt = now()
  return record
}

function applyOnce(instance: ApprovalInstance, apply: (record: GenericBusinessRecord) => void) {
  const record = upsertRecord(instance, '已通过')
  if (record.applied)
    return
  apply(record)
  record.applied = true
  record.appliedAt = now()
  record.updatedAt = now()
}

function handlePending(instance: ApprovalInstance) {
  upsertRecord(instance, '审批中')
  void persistApprovalBusinessState().catch(error => console.error('[approval-business] failed to persist pending state', error))
}

function handleRejected(instance: ApprovalInstance) {
  upsertRecord(instance, '已驳回')
  void persistApprovalBusinessState().catch(error => console.error('[approval-business] failed to persist rejected state', error))
}

function handleRevoked(instance: ApprovalInstance) {
  upsertRecord(instance, '已撤回')
  void persistApprovalBusinessState().catch(error => console.error('[approval-business] failed to persist revoked state', error))
}

function applyLeave(instance: ApprovalInstance) {
  applyOnce(instance, (record) => {
    const employeeId = record.payload.employeeId || instance.applicantId
    const start = dayjs(record.payload.startTime || record.payload.startDate || record.payload.leaveStartDate)
    const end = dayjs(record.payload.endTime || record.payload.endDate || record.payload.leaveEndDate)
    const days = start.isValid() && end.isValid() ? Math.max(end.diff(start, 'day') + 1, 1) : Number(record.payload.leaveDays || 1)
    let balance = state.leaveBalances.find(item => String(item.employeeId) === String(employeeId))
    if (!balance) {
      balance = { employeeId, annualLeaveDays: 10, usedLeaveDays: 0 }
      state.leaveBalances.push(balance)
    }
    balance.usedLeaveDays += days
    record.payload.leaveStartDate = start.isValid() ? start.format('YYYY-MM-DD') : record.payload.leaveStartDate
    record.payload.leaveEndDate = end.isValid() ? end.format('YYYY-MM-DD') : record.payload.leaveEndDate
  })
  void persistApprovalBusinessState().catch(error => console.error('[approval-business] failed to persist leave approval state', error))
}

function applyCashExpense(instance: ApprovalInstance) {
  applyOnce(instance, (record) => {
    const accountId = record.payload.accountId || 'cash-default'
    const account = state.cashAccounts.find(item => item.id === accountId)
    if (!account)
      throw new Error('现金账户不存在')
    const amount = Number(instance.amount || record.payload.amount || 0)
    if (amount < 0)
      throw new Error('现金支出金额不能为负数')
    if (account.balance < amount)
      throw new Error('现金账户余额不足')
    account.balance = Number((account.balance - amount).toFixed(2))
    state.cashFlows.push({
      id: nextId('flow'),
      approvalInstanceId: instance.id,
      accountId,
      flowType: '支出',
      amount,
      title: instance.title,
      createdAt: now(),
    })
  })
  void persistApprovalBusinessState().catch(error => console.error('[approval-business] failed to persist cash approval state', error))
}

function applyGenericExpense(instance: ApprovalInstance) {
  applyOnce(instance, (record) => {
    record.payload.paymentStatus = record.payload.paymentStatus || '待付款'
    record.payload.expenseGenerated = true
  })
  void persistApprovalBusinessState().catch(error => console.error('[approval-business] failed to persist generic approval state', error))
}

function registerGenericHandler(businessType: string, onApproved: (instance: ApprovalInstance) => void) {
  registerApprovalBusinessHandler(businessType, {
    snapshot,
    restore,
    onPending: handlePending,
    onApproved,
    onRejected: handleRejected,
    onRevoked: handleRevoked,
  })
}

registerGenericHandler('leave', applyLeave)
registerGenericHandler('cash_expense', applyCashExpense)
;[
  'expense',
  'payment',
  'purchase',
  'reimbursement',
  'transport_fuel',
  'transport_etc',
  'transport_maintenance',
  'transport_exception_fee',
  'vehicle_loan',
  'office_vehicle_expense',
  'contract',
  'trade_contract',
  'receivable',
  'receipt',
  'salary',
  'attendance_adjustment',
  'overtime',
  'travel',
  'hr_change',
  'inventory_adjustment',
  'asset_purchase',
  'asset_scrap',
  'general',
].forEach(businessType => registerGenericHandler(businessType, applyGenericExpense))

export function listApprovalBusinessState() {
  return state
}
