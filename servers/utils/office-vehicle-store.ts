import type mysql from 'mysql2/promise'
import type { VehicleRecordPermissions } from '../services/vehicle-business/permissions'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import dayjs from 'dayjs'
import { officeVehiclePermissions, withoutRecordPermissions } from '../services/vehicle-business/permissions'
import { assertStatusTransition, assertStatusValue, expenseApprovalTransitions } from '../services/vehicle-business/workflow'
import { registerApprovalBusinessHandler } from './approval-callback-dispatcher'
import { approvalStore } from './approval-store'
import { resolveJsonDataFile } from './data-paths'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { transportOperationStore } from './transport-operation-store'

type Role = 'ADMIN' | 'OFFICE_ADMIN' | 'FINANCE_MANAGER' | 'DEPT_LEADER' | 'USER' | string
export type VehicleStatus = '正常' | '停用' | '维修中' | '已出售'
export type ExpenseStatus = '草稿' | '待审批' | '审批中' | '已确认' | '已驳回' | '已撤回'
export type ReminderStatus = '正常' | '即将到期' | '已过期' | '已处理'
export type LicenseStatus = '有效' | '即将到期' | '已过期'

export interface OperatorContext {
  userId?: string | number
  userName?: string
  deptId?: string | number
  deptName?: string
  roles?: Role[]
}

export interface OfficeVehicle {
  id: string
  plateNo: string
  vehicleType: string
  brandModel: string
  departmentId?: string | number
  departmentName: string
  ownerUserId?: string | number
  ownerName: string
  defaultDriverId?: string | number
  defaultDriverName?: string
  status: VehicleStatus
  purchaseDate?: string
  photoUrl?: string
  remark?: string
  createdBy?: string | number
  permissions?: VehicleRecordPermissions
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OfficeVehicleExpense {
  id: string
  vehicleId: string
  plateNo: string
  expenseType: string
  amount: number
  occurredDate: string
  handlerId?: string | number
  handlerName: string
  departmentId?: string | number
  departmentName: string
  paymentMethod: string
  invoiceNo?: string
  attachmentName?: string
  attachmentUrl?: string
  needApproval: boolean
  approvalStatus: ExpenseStatus
  approvalInstanceId?: string
  remark?: string
  createdBy?: string | number
  permissions?: VehicleRecordPermissions
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OfficeVehicleLicense {
  id: string
  vehicleId: string
  plateNo: string
  licenseType: string
  licenseNo: string
  issueDate?: string
  expiryDate: string
  issuingAuthority?: string
  attachmentName?: string
  attachmentUrl?: string
  status: LicenseStatus
  remark?: string
  createdBy?: string | number
  permissions?: VehicleRecordPermissions
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OfficeVehicleInsurance {
  id: string
  vehicleId: string
  plateNo: string
  insuranceType: string
  policyNo: string
  insurer: string
  amount: number
  startDate: string
  endDate: string
  attachmentName?: string
  attachmentUrl?: string
  status: LicenseStatus
  remark?: string
  createdBy?: string | number
  permissions?: VehicleRecordPermissions
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OfficeVehicleReminder {
  id: string
  vehicleId: string
  plateNo: string
  reminderType: string
  dueDate: string
  remindDays: number
  targetUserIds: Array<string | number>
  targetNames: string[]
  status: ReminderStatus
  handled: boolean
  handledAt?: string
  handleRemark?: string
  sourceType?: 'license' | 'insurance' | 'maintenance' | 'custom'
  sourceId?: string
  createdBy?: string | number
  permissions?: VehicleRecordPermissions
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface OfficeVehicleOperationLog {
  id: string
  module: 'vehicle' | 'expense' | 'license' | 'insurance' | 'reminder'
  recordId: string
  action: string
  operatorId?: string | number
  operatorName: string
  content: string
  createdAt: string
}

export interface OfficeVehicleQuery extends OperatorContext {
  current?: number
  pageSize?: number
  vehicleId?: string
  plateNo?: string
  expenseType?: string
  licenseType?: string
  insuranceType?: string
  reminderType?: string
  departmentName?: string
  status?: string
  startDate?: string
  endDate?: string
  financialYear?: number | string
  financialMonth?: number | string
}

export interface OfficeVehicleBatchSavePayload {
  vehicle: Partial<OfficeVehicle>
  expenses?: Array<Partial<OfficeVehicleExpense>>
  licenses?: Array<Partial<OfficeVehicleLicense>>
  insurances?: Array<Partial<OfficeVehicleInsurance>>
  reminders?: Array<Partial<OfficeVehicleReminder>>
}

interface MutationOptions {
  hydrate?: boolean
  persist?: boolean
}

interface OfficeVehicleState {
  vehicles: OfficeVehicle[]
  expenses: OfficeVehicleExpense[]
  licenses: OfficeVehicleLicense[]
  insurances: OfficeVehicleInsurance[]
  reminders: OfficeVehicleReminder[]
  logs: OfficeVehicleOperationLog[]
  seq: number
}

const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const dataFile = resolveJsonDataFile('office-vehicle.json')
const globalStore = globalThis as any

function now() {
  return dayjs().format(DATE_TIME_FORMAT)
}

function readDataFile() {
  if (!existsSync(dataFile))
    return undefined
  try {
    return JSON.parse(readFileSync(dataFile, 'utf-8')) as OfficeVehicleState
  }
  catch {
    return undefined
  }
}

function writeDataFile(data: OfficeVehicleState) {
  mkdirSync(dirname(dataFile), { recursive: true })
  writeFileSync(dataFile, JSON.stringify(data, null, 2))
}

function initialState(): OfficeVehicleState {
  return {
    seq: 1000,
    vehicles: [
      { id: 'veh1', plateNo: '沪A·8899', vehicleType: '商务车', brandModel: '别克GL8', departmentId: 'admin', departmentName: '综合管理部', ownerUserId: 1, ownerName: '超级管理员', defaultDriverId: 2, defaultDriverName: '普通用户', status: '正常', purchaseDate: '2024-03-12', photoUrl: '/logo.png', remark: '行政接待与证照办理用车', createdAt: '2026-07-01 09:00:00', updatedAt: '2026-07-01 09:00:00' },
      { id: 'veh2', plateNo: '沪B·6688', vehicleType: '轿车', brandModel: '大众帕萨特', departmentId: 'finance', departmentName: '财务部', ownerUserId: 3, ownerName: '财务经理', defaultDriverId: 3, defaultDriverName: '财务经理', status: '正常', purchaseDate: '2023-11-20', photoUrl: '/logo.png', remark: '财务外勤与银行业务', createdAt: '2026-07-01 09:10:00', updatedAt: '2026-07-01 09:10:00' },
      { id: 'veh3', plateNo: '沪C·7788', vehicleType: 'SUV', brandModel: '丰田RAV4', departmentId: 'transport', departmentName: '运输部', ownerUserId: 4, ownerName: '部门负责人', defaultDriverId: 2, defaultDriverName: '普通用户', status: '维修中', purchaseDate: '2022-08-18', photoUrl: '/logo.png', remark: '项目现场支持用车', createdAt: '2026-07-01 09:20:00', updatedAt: '2026-07-01 09:20:00' },
    ],
    expenses: [
      { id: 'exp1', vehicleId: 'veh1', plateNo: '沪A·8899', expenseType: '停车费', amount: 20, occurredDate: '2026-07-06', handlerId: 1, handlerName: '超级管理员', departmentId: 'admin', departmentName: '综合管理部', paymentMethod: '企业微信', invoiceNo: 'INV20260706001', attachmentName: '停车票_OV20260706001.jpg', attachmentUrl: '/attachments/parking.jpg', needApproval: false, approvalStatus: '已确认', remark: '证照办理停车费', createdAt: '2026-07-06 12:10:00', updatedAt: '2026-07-06 12:10:00' },
      { id: 'exp2', vehicleId: 'veh2', plateNo: '沪B·6688', expenseType: '加油费', amount: 392, occurredDate: '2026-07-05', handlerId: 3, handlerName: '财务经理', departmentId: 'finance', departmentName: '财务部', paymentMethod: '公务卡', invoiceNo: 'INV20260705002', attachmentName: '油票_沪B6688.pdf', attachmentUrl: '/attachments/fuel.pdf', needApproval: true, approvalStatus: '待审批', remark: '银行对账外勤加油', createdAt: '2026-07-05 18:30:00', updatedAt: '2026-07-05 18:30:00' },
      { id: 'exp3', vehicleId: 'veh3', plateNo: '沪C·7788', expenseType: '维修费', amount: 1280, occurredDate: '2026-07-04', handlerId: 4, handlerName: '部门负责人', departmentId: 'transport', departmentName: '运输部', paymentMethod: '银行转账', invoiceNo: 'INV20260704003', attachmentName: '维修清单_沪C7788.pdf', attachmentUrl: '/attachments/repair.pdf', needApproval: true, approvalStatus: '审批中', remark: '例行维保与刹车检查', createdAt: '2026-07-04 16:40:00', updatedAt: '2026-07-04 16:40:00' },
    ],
    licenses: [
      { id: 'lic1', vehicleId: 'veh1', plateNo: '沪A·8899', licenseType: '行驶证', licenseNo: 'XSZ-A8899', issueDate: '2024-03-12', expiryDate: '2027-03-11', issuingAuthority: '上海市公安局交通警察总队', attachmentName: '行驶证_沪A8899.jpg', attachmentUrl: '/attachments/license-a.jpg', status: '有效', remark: '', createdAt: '2026-07-01 10:00:00', updatedAt: '2026-07-01 10:00:00' },
      { id: 'lic2', vehicleId: 'veh3', plateNo: '沪C·7788', licenseType: '道路运输证', licenseNo: 'DLYSZ-C7788', issueDate: '2025-07-25', expiryDate: '2026-07-25', issuingAuthority: '上海市道路运输管理局', attachmentName: '道路运输证_沪C7788.pdf', attachmentUrl: '/attachments/road-c.pdf', status: '即将到期', remark: '需提前办理年审', createdAt: '2026-07-01 10:10:00', updatedAt: '2026-07-01 10:10:00' },
    ],
    insurances: [
      { id: 'ins1', vehicleId: 'veh3', plateNo: '沪C·7788', insuranceType: '商业险', policyNo: 'POL-C7788-2025', insurer: '平安保险', amount: 5800, startDate: '2025-07-21', endDate: '2026-07-20', attachmentName: '商业险_沪C7788.pdf', status: '即将到期', remark: '30 天内到期', createdAt: '2026-07-01 10:30:00', updatedAt: '2026-07-01 10:30:00' },
      { id: 'ins2', vehicleId: 'veh2', plateNo: '沪B·6688', insuranceType: '交强险', policyNo: 'POL-B6688-2026', insurer: '太平洋保险', amount: 950, startDate: '2026-01-01', endDate: '2026-12-31', attachmentName: '交强险_沪B6688.pdf', status: '有效', remark: '', createdAt: '2026-07-01 10:40:00', updatedAt: '2026-07-01 10:40:00' },
    ],
    reminders: [
      { id: 'rem1', vehicleId: 'veh3', plateNo: '沪C·7788', reminderType: '商业险到期', dueDate: '2026-07-20', remindDays: 30, targetUserIds: [4, 3], targetNames: ['部门负责人', '财务经理'], status: '即将到期', handled: false, sourceType: 'insurance', sourceId: 'ins1', createdAt: '2026-07-01 11:00:00', updatedAt: '2026-07-01 11:00:00' },
      { id: 'rem2', vehicleId: 'veh3', plateNo: '沪C·7788', reminderType: '道路运输证到期', dueDate: '2026-07-25', remindDays: 30, targetUserIds: [4], targetNames: ['部门负责人'], status: '即将到期', handled: false, sourceType: 'license', sourceId: 'lic2', createdAt: '2026-07-01 11:10:00', updatedAt: '2026-07-01 11:10:00' },
      { id: 'rem3', vehicleId: 'veh1', plateNo: '沪A·8899', reminderType: '保养到期', dueDate: '2026-06-20', remindDays: 15, targetUserIds: [1], targetNames: ['超级管理员'], status: '已过期', handled: false, sourceType: 'maintenance', createdAt: '2026-06-01 09:00:00', updatedAt: '2026-06-20 09:00:00' },
    ],
    logs: [
      { id: 'log1', module: 'expense', recordId: 'exp3', action: 'CREATE', operatorId: 4, operatorName: '部门负责人', content: '新增维修费 1280 元', createdAt: '2026-07-04 16:40:00' },
    ],
  }
}

if (!globalStore.__officeVehicleState) {
  globalStore.__officeVehicleState = isDatabaseRequired()
    ? { seq: 1000, vehicles: [], expenses: [], licenses: [], insurances: [], reminders: [], logs: [] }
    : (readDataFile() || initialState())
  if (!isDatabaseRequired() && !existsSync(dataFile))
    writeDataFile(globalStore.__officeVehicleState)
}

const state = globalStore.__officeVehicleState as OfficeVehicleState
let regulatoryVehicleSyncQueue: Promise<void> = Promise.resolve()

function snapshotState() {
  return structuredClone(state) as OfficeVehicleState
}

function restoreState(snapshot: OfficeVehicleState) {
  state.vehicles = snapshot.vehicles
  state.expenses = snapshot.expenses
  state.licenses = snapshot.licenses
  state.insurances = snapshot.insurances
  state.reminders = snapshot.reminders
  state.logs = snapshot.logs
  state.seq = snapshot.seq
}

function batchItemError(label: string, index: number, error: unknown) {
  const reason = error instanceof Error ? error.message : '保存失败'
  return new Error(`${label}第 ${index + 1} 条：${reason}`)
}

function nextId(prefix: string) {
  state.seq += 1
  return `${prefix}${state.seq}`
}

function formatDate(value: unknown) {
  if (!value)
    return undefined
  return dayjs(value as any).format('YYYY-MM-DD')
}

function formatDateTime(value: unknown) {
  if (!value)
    return now()
  return dayjs(value as any).format(DATE_TIME_FORMAT)
}

function parseCsv(value: unknown) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

async function ensureColumn(db: mysql.Pool, table: string, column: string, definition: string) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  catch (error: any) {
    if (error?.code !== 'ER_DUP_FIELDNAME')
      throw error
  }
}

async function ensureOfficeVehicleSchema(db: mysql.Pool) {
  await db.query(`
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
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      deleted_at DATETIME NULL,
      KEY idx_office_vehicle_status (status),
      KEY idx_office_vehicle_department (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      deleted_at DATETIME NULL,
      KEY idx_office_vehicle_expense_vehicle_date (vehicle_id, occurred_date),
      KEY idx_office_vehicle_expense_type (expense_type),
      KEY idx_office_vehicle_expense_status (approval_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      deleted_at DATETIME NULL,
      KEY idx_office_vehicle_license_vehicle (vehicle_id),
      KEY idx_office_vehicle_license_expiry (expiry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      deleted_at DATETIME NULL,
      KEY idx_office_vehicle_insurance_vehicle (vehicle_id),
      KEY idx_office_vehicle_insurance_end_date (end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      deleted_at DATETIME NULL,
      KEY idx_office_vehicle_reminder_due_date (due_date),
      KEY idx_office_vehicle_reminder_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await Promise.all([
    ensureColumn(db, 'office_vehicle', 'created_by', 'VARCHAR(64) NULL'),
    ensureColumn(db, 'office_vehicle_expense', 'created_by', 'VARCHAR(64) NULL'),
    ensureColumn(db, 'office_vehicle_license', 'created_by', 'VARCHAR(64) NULL'),
    ensureColumn(db, 'office_vehicle_insurance', 'attachment_url', 'VARCHAR(512) NULL'),
    ensureColumn(db, 'office_vehicle_insurance', 'created_by', 'VARCHAR(64) NULL'),
    ensureColumn(db, 'office_vehicle_reminder', 'created_by', 'VARCHAR(64) NULL'),
  ])
  await Promise.all([
    db.query('UPDATE office_vehicle SET created_by = COALESCE(created_by, owner_user_id) WHERE created_by IS NULL'),
    db.query('UPDATE office_vehicle_expense SET created_by = COALESCE(created_by, handler_id) WHERE created_by IS NULL'),
    db.query('UPDATE office_vehicle_license item JOIN office_vehicle vehicle ON vehicle.id = item.vehicle_id SET item.created_by = vehicle.created_by WHERE item.created_by IS NULL'),
    db.query('UPDATE office_vehicle_insurance item JOIN office_vehicle vehicle ON vehicle.id = item.vehicle_id SET item.created_by = vehicle.created_by WHERE item.created_by IS NULL'),
    db.query('UPDATE office_vehicle_reminder item JOIN office_vehicle vehicle ON vehicle.id = item.vehicle_id SET item.created_by = vehicle.created_by WHERE item.created_by IS NULL'),
  ])
}

async function loadOfficeVehicleStateFromMysql() {
  const db = getMysqlPool()
  if (!db)
    return false

  await ensureOfficeVehicleSchema(db)

  const [vehicleRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM office_vehicle ORDER BY created_at DESC')
  const [expenseRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM office_vehicle_expense ORDER BY occurred_date DESC, created_at DESC')
  const [licenseRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM office_vehicle_license ORDER BY expiry_date ASC')
  const [insuranceRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM office_vehicle_insurance ORDER BY end_date ASC')
  const [reminderRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM office_vehicle_reminder ORDER BY due_date ASC')
  const [logRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM office_vehicle_operation_log ORDER BY created_at DESC')

  if (!vehicleRows.length && !expenseRows.length && !licenseRows.length && !insuranceRows.length && !reminderRows.length && !logRows.length) {
    if (!isDatabaseRequired())
      await persistOfficeVehicleStateToMysql()
    return true
  }

  state.vehicles = vehicleRows.map((row: any) => ({
    id: String(row.id),
    plateNo: row.plate_no,
    vehicleType: row.vehicle_type,
    brandModel: row.brand_model,
    departmentId: row.department_id || undefined,
    departmentName: row.department_name,
    ownerUserId: row.owner_user_id || undefined,
    ownerName: row.owner_name,
    defaultDriverId: row.default_driver_id || undefined,
    defaultDriverName: row.default_driver_name || undefined,
    status: row.status,
    purchaseDate: formatDate(row.purchase_date),
    photoUrl: row.photo_url || undefined,
    remark: row.remark || undefined,
    createdBy: row.created_by || row.owner_user_id || undefined,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    deletedAt: row.deleted_at ? formatDateTime(row.deleted_at) : undefined,
  }))
  state.expenses = expenseRows.map((row: any) => ({
    id: String(row.id),
    vehicleId: row.vehicle_id,
    plateNo: row.plate_no,
    expenseType: row.expense_type,
    amount: Number(row.amount || 0),
    occurredDate: formatDate(row.occurred_date) || '',
    handlerId: row.handler_id || undefined,
    handlerName: row.handler_name,
    departmentId: row.department_id || undefined,
    departmentName: row.department_name,
    paymentMethod: row.payment_method,
    invoiceNo: row.invoice_no || undefined,
    attachmentName: row.attachment_name || undefined,
    attachmentUrl: row.attachment_url || undefined,
    needApproval: Boolean(row.need_approval),
    approvalStatus: row.approval_status,
    approvalInstanceId: row.approval_instance_id || undefined,
    remark: row.remark || undefined,
    createdBy: row.created_by || row.handler_id || undefined,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    deletedAt: row.deleted_at ? formatDateTime(row.deleted_at) : undefined,
  }))
  state.licenses = licenseRows.map((row: any) => ({
    id: String(row.id),
    vehicleId: row.vehicle_id,
    plateNo: row.plate_no,
    licenseType: row.license_type,
    licenseNo: row.license_no,
    issueDate: formatDate(row.issue_date),
    expiryDate: formatDate(row.expiry_date) || '',
    issuingAuthority: row.issuing_authority || undefined,
    attachmentName: row.attachment_name || undefined,
    attachmentUrl: row.attachment_url || undefined,
    status: row.status,
    remark: row.remark || undefined,
    createdBy: row.created_by || undefined,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    deletedAt: row.deleted_at ? formatDateTime(row.deleted_at) : undefined,
  }))
  state.insurances = insuranceRows.map((row: any) => ({
    id: String(row.id),
    vehicleId: row.vehicle_id,
    plateNo: row.plate_no,
    insuranceType: row.insurance_type,
    policyNo: row.policy_no,
    insurer: row.insurer,
    amount: Number(row.amount || 0),
    startDate: formatDate(row.start_date) || '',
    endDate: formatDate(row.end_date) || '',
    attachmentName: row.attachment_name || undefined,
    attachmentUrl: row.attachment_url || undefined,
    status: row.status,
    remark: row.remark || undefined,
    createdBy: row.created_by || undefined,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    deletedAt: row.deleted_at ? formatDateTime(row.deleted_at) : undefined,
  }))
  state.reminders = reminderRows.map((row: any) => ({
    id: String(row.id),
    vehicleId: row.vehicle_id,
    plateNo: row.plate_no,
    reminderType: row.reminder_type,
    dueDate: formatDate(row.due_date) || '',
    remindDays: Number(row.remind_days || 30),
    targetUserIds: parseCsv(row.target_user_ids),
    targetNames: parseCsv(row.target_names),
    status: row.status,
    handled: Boolean(row.handled),
    handledAt: row.handled_at ? formatDateTime(row.handled_at) : undefined,
    handleRemark: row.handle_remark || undefined,
    sourceType: row.source_type || undefined,
    sourceId: row.source_id || undefined,
    createdBy: row.created_by || undefined,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    deletedAt: row.deleted_at ? formatDateTime(row.deleted_at) : undefined,
  }))
  state.logs = logRows.map((row: any) => ({
    id: String(row.id),
    module: row.module,
    recordId: row.record_id,
    action: row.action,
    operatorId: row.operator_id || undefined,
    operatorName: row.operator_name,
    content: row.content,
    createdAt: formatDateTime(row.created_at),
  }))
  state.seq = Math.max(1000, ...[
    ...state.vehicles,
    ...state.expenses,
    ...state.licenses,
    ...state.insurances,
    ...state.reminders,
    ...state.logs,
  ].map(item => Number(String(item.id).match(/\d+/)?.[0] || 0))) + 1
  return true
}

async function writeOfficeVehicleState(db: mysql.Pool | mysql.PoolConnection) {
  for (const item of state.vehicles) {
    await db.execute(`
      INSERT INTO office_vehicle (id, plate_no, vehicle_type, brand_model, department_id, department_name, owner_user_id, owner_name, default_driver_id, default_driver_name, status, purchase_date, photo_url, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE plate_no=VALUES(plate_no), vehicle_type=VALUES(vehicle_type), brand_model=VALUES(brand_model), department_id=VALUES(department_id), department_name=VALUES(department_name), owner_user_id=VALUES(owner_user_id), owner_name=VALUES(owner_name), default_driver_id=VALUES(default_driver_id), default_driver_name=VALUES(default_driver_name), status=VALUES(status), purchase_date=VALUES(purchase_date), photo_url=VALUES(photo_url), remark=VALUES(remark), created_by=COALESCE(created_by, VALUES(created_by)), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)
    `, [item.id, item.plateNo, item.vehicleType, item.brandModel, item.departmentId || null, item.departmentName, item.ownerUserId == null ? null : String(item.ownerUserId), item.ownerName, item.defaultDriverId == null ? null : String(item.defaultDriverId), item.defaultDriverName || null, item.status, item.purchaseDate || null, item.photoUrl || null, item.remark || null, item.createdBy == null ? null : String(item.createdBy), item.createdAt, item.updatedAt, item.deletedAt || null])
  }
  for (const item of state.expenses) {
    await db.execute(`
      INSERT INTO office_vehicle_expense (id, vehicle_id, plate_no, expense_type, amount, occurred_date, handler_id, handler_name, department_id, department_name, payment_method, invoice_no, attachment_name, attachment_url, need_approval, approval_status, approval_instance_id, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), expense_type=VALUES(expense_type), amount=VALUES(amount), occurred_date=VALUES(occurred_date), handler_id=VALUES(handler_id), handler_name=VALUES(handler_name), department_id=VALUES(department_id), department_name=VALUES(department_name), payment_method=VALUES(payment_method), invoice_no=VALUES(invoice_no), attachment_name=VALUES(attachment_name), attachment_url=VALUES(attachment_url), need_approval=VALUES(need_approval), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), remark=VALUES(remark), created_by=COALESCE(created_by, VALUES(created_by)), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)
    `, [item.id, item.vehicleId, item.plateNo, item.expenseType, item.amount, item.occurredDate, item.handlerId == null ? null : String(item.handlerId), item.handlerName, item.departmentId == null ? null : String(item.departmentId), item.departmentName, item.paymentMethod, item.invoiceNo || null, item.attachmentName || null, item.attachmentUrl || null, item.needApproval ? 1 : 0, item.approvalStatus, item.approvalInstanceId || null, item.remark || null, item.createdBy == null ? null : String(item.createdBy), item.createdAt, item.updatedAt, item.deletedAt || null])
  }
  for (const item of state.licenses) {
    await db.execute(`
      INSERT INTO office_vehicle_license (id, vehicle_id, plate_no, license_type, license_no, issue_date, expiry_date, issuing_authority, attachment_name, attachment_url, status, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), license_type=VALUES(license_type), license_no=VALUES(license_no), issue_date=VALUES(issue_date), expiry_date=VALUES(expiry_date), issuing_authority=VALUES(issuing_authority), attachment_name=VALUES(attachment_name), attachment_url=VALUES(attachment_url), status=VALUES(status), remark=VALUES(remark), created_by=COALESCE(created_by, VALUES(created_by)), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)
    `, [item.id, item.vehicleId, item.plateNo, item.licenseType, item.licenseNo, item.issueDate || null, item.expiryDate, item.issuingAuthority || null, item.attachmentName || null, item.attachmentUrl || null, item.status, item.remark || null, item.createdBy == null ? null : String(item.createdBy), item.createdAt, item.updatedAt, item.deletedAt || null])
  }
  for (const item of state.insurances) {
    await db.execute(`
      INSERT INTO office_vehicle_insurance (id, vehicle_id, plate_no, insurance_type, policy_no, insurer, amount, start_date, end_date, attachment_name, attachment_url, status, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), insurance_type=VALUES(insurance_type), policy_no=VALUES(policy_no), insurer=VALUES(insurer), amount=VALUES(amount), start_date=VALUES(start_date), end_date=VALUES(end_date), attachment_name=VALUES(attachment_name), attachment_url=VALUES(attachment_url), status=VALUES(status), remark=VALUES(remark), created_by=COALESCE(created_by, VALUES(created_by)), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)
    `, [item.id, item.vehicleId, item.plateNo, item.insuranceType, item.policyNo, item.insurer, item.amount, item.startDate, item.endDate, item.attachmentName || null, item.attachmentUrl || null, item.status, item.remark || null, item.createdBy == null ? null : String(item.createdBy), item.createdAt, item.updatedAt, item.deletedAt || null])
  }
  for (const item of state.reminders) {
    await db.execute(`
      INSERT INTO office_vehicle_reminder (id, vehicle_id, plate_no, reminder_type, due_date, remind_days, target_user_ids, target_names, status, handled, handled_at, handle_remark, source_type, source_id, created_by, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), reminder_type=VALUES(reminder_type), due_date=VALUES(due_date), remind_days=VALUES(remind_days), target_user_ids=VALUES(target_user_ids), target_names=VALUES(target_names), status=VALUES(status), handled=VALUES(handled), handled_at=VALUES(handled_at), handle_remark=VALUES(handle_remark), source_type=VALUES(source_type), source_id=VALUES(source_id), created_by=COALESCE(created_by, VALUES(created_by)), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)
    `, [item.id, item.vehicleId, item.plateNo, item.reminderType, item.dueDate, item.remindDays, item.targetUserIds.join(','), item.targetNames.join(','), item.status, item.handled ? 1 : 0, item.handledAt || null, item.handleRemark || null, item.sourceType || null, item.sourceId || null, item.createdBy == null ? null : String(item.createdBy), item.createdAt, item.updatedAt, item.deletedAt || null])
  }
  for (const item of state.logs) {
    await db.execute(`
      INSERT INTO office_vehicle_operation_log (id, module, record_id, action, operator_id, operator_name, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE module=VALUES(module), record_id=VALUES(record_id), action=VALUES(action), operator_id=VALUES(operator_id), operator_name=VALUES(operator_name), content=VALUES(content)
    `, [item.id, item.module, item.recordId, item.action, item.operatorId == null ? null : String(item.operatorId), item.operatorName, item.content, item.createdAt])
  }
}

async function persistOfficeVehicleStateToMysql() {
  const db = getMysqlPool()
  if (!db)
    return

  await ensureOfficeVehicleSchema(db)
  await withMysqlTransaction(db, connection => writeOfficeVehicleState(connection))
}

async function hydrateOfficeVehicleState() {
  await loadOfficeVehicleStateFromMysql()
}

function updateExpenseApprovalFromCallback(instanceId: string, status: ExpenseStatus) {
  const record = state.expenses.find(item => item.approvalInstanceId === instanceId && !item.deletedAt)
  if (!record || record.approvalStatus === status)
    return

  record.approvalStatus = status
  record.updatedAt = now()
  addLog('expense', record.id, 'APPROVAL_CALLBACK', `审批回写为${status}`, { userName: '审批中心' })
  void persist()
}

registerApprovalBusinessHandler('office_vehicle_expense', {
  snapshot: () => JSON.parse(JSON.stringify(state)),
  restore: (snapshot) => {
    const source = snapshot as OfficeVehicleState
    state.vehicles = source.vehicles
    state.expenses = source.expenses
    state.licenses = source.licenses
    state.insurances = source.insurances
    state.reminders = source.reminders
    state.logs = source.logs
    state.seq = source.seq
    void persist()
  },
  onPending: instance => updateExpenseApprovalFromCallback(instance.id, '审批中'),
  onApproved: instance => updateExpenseApprovalFromCallback(instance.id, '已确认'),
  onRejected: instance => updateExpenseApprovalFromCallback(instance.id, '已驳回'),
  onRevoked: instance => updateExpenseApprovalFromCallback(instance.id, '已撤回'),
})

async function persist() {
  refreshStatuses()
  if (getMysqlPool())
    await persistOfficeVehicleStateToMysql()
  else if (!isDatabaseRequired())
    writeDataFile(state)
}

function assertOfficeAdmin(context: OperatorContext = {}) {
  const roles = context.roles || []
  if (!roles.some(role => ['ADMIN', 'OFFICE_ADMIN'].includes(String(role))))
    throw new Error('无车辆档案维护权限')
}

function assertFinanceOrAdmin(context: OperatorContext = {}) {
  const roles = context.roles || []
  if (!roles.some(role => ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'].includes(String(role))))
    throw new Error('无费用维护权限')
}

function canViewVehicle(vehicle: OfficeVehicle, context: OperatorContext = {}) {
  const roles = context.roles || []
  if (roles.some(role => ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'].includes(String(role))))
    return true
  return String(vehicle.ownerUserId) === String(context.userId)
    || String(vehicle.defaultDriverId) === String(context.userId)
    || String(vehicle.departmentId) === String(context.deptId)
}

function visibleVehicleIds(context: OperatorContext = {}) {
  return new Set(state.vehicles.filter(item => !item.deletedAt && canViewVehicle(item, context)).map(item => item.id))
}

function createdByFor(kind: 'vehicle' | 'expense' | 'license' | 'insurance' | 'reminder', record: Record<string, any>) {
  if (record.createdBy != null)
    return record.createdBy
  if (kind === 'vehicle')
    return record.ownerUserId
  if (kind === 'expense')
    return record.handlerId
  return state.vehicles.find(vehicle => vehicle.id === record.vehicleId)?.createdBy
    ?? state.vehicles.find(vehicle => vehicle.id === record.vehicleId)?.ownerUserId
}

function presentRecord<T extends Record<string, any>>(
  kind: 'vehicle' | 'expense' | 'license' | 'insurance' | 'reminder',
  record: T,
  context: OperatorContext,
): T & { createdBy?: string | number, permissions: VehicleRecordPermissions } {
  const createdBy = createdByFor(kind, record)
  const presented = { ...record, createdBy }
  return { ...presented, permissions: officeVehiclePermissions(kind, presented, context) }
}

function dateRange(query: OfficeVehicleQuery) {
  if (query.startDate && query.endDate)
    return { startDate: String(query.startDate), endDate: String(query.endDate) }
  if (query.financialYear && query.financialMonth) {
    const start = dayjs().year(Number(query.financialYear)).month(Number(query.financialMonth) - 1).date(1)
    return { startDate: start.format('YYYY-MM-DD'), endDate: start.endOf('month').format('YYYY-MM-DD') }
  }
  return undefined
}

function inRange(date: string, query: OfficeVehicleQuery) {
  const range = dateRange(query)
  if (!range)
    return true
  const value = dayjs(date)
  return !value.isBefore(range.startDate, 'day') && !value.isAfter(range.endDate, 'day')
}

function resolveDueStatus(dueDate: string, remindDays = 30): ReminderStatus {
  const today = dayjs().startOf('day')
  const due = dayjs(dueDate).startOf('day')
  if (due.isBefore(today, 'day'))
    return '已过期'
  if (due.diff(today, 'day') <= remindDays)
    return '即将到期'
  return '正常'
}

function resolveLicenseStatus(expiryDate: string): LicenseStatus {
  const status = resolveDueStatus(expiryDate, 30)
  if (status === '已过期')
    return '已过期'
  if (status === '即将到期')
    return '即将到期'
  return '有效'
}

function refreshStatuses() {
  state.licenses.forEach((item) => {
    if (!item.deletedAt)
      item.status = resolveLicenseStatus(item.expiryDate)
  })
  state.insurances.forEach((item) => {
    if (!item.deletedAt)
      item.status = resolveLicenseStatus(item.endDate)
  })
  state.reminders.forEach((item) => {
    if (!item.deletedAt && !item.handled)
      item.status = resolveDueStatus(item.dueDate, item.remindDays)
  })
}

function page<T>(records: T[], query: OfficeVehicleQuery) {
  const current = Number(query.current || 1)
  const pageSize = Number(query.pageSize || 10)
  return {
    records: records.slice((current - 1) * pageSize, current * pageSize),
    total: records.length,
  }
}

function addLog(module: OfficeVehicleOperationLog['module'], recordId: string, action: string, content: string, context: OperatorContext = {}) {
  state.logs.unshift({
    id: nextId('log'),
    module,
    recordId,
    action,
    operatorId: context.userId || 1,
    operatorName: context.userName || '超级管理员',
    content,
    createdAt: now(),
  })
}

function vehicleById(id: string) {
  const vehicle = state.vehicles.find(item => item.id === id && !item.deletedAt)
  if (!vehicle)
    throw new Error('车辆不存在')
  return vehicle
}

function normalizePlateNo(value: unknown) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[.．。•]/g, '·')
    .replace(/\s+/g, '')
}

function plateNoKey(value: unknown) {
  return normalizePlateNo(value).replace(/[·-]/g, '')
}

async function getTransportBaseVehicleKeys() {
  const { baseVehicles } = await transportOperationStore.getDataset()
  return new Set(baseVehicles.map(vehicle => plateNoKey(vehicle.code || vehicle.plateNo)).filter(Boolean))
}

async function isTransportBaseVehicle(plateNo: string, knownKeys?: ReadonlySet<string>) {
  const normalizedPlateNo = plateNoKey(plateNo)
  const keys = knownKeys ?? await getTransportBaseVehicleKeys()
  return keys.has(normalizedPlateNo)
}

async function assertNotTransportBaseVehicle(plateNo: string) {
  if (await isTransportBaseVehicle(plateNo))
    throw new Error('该车辆已存在于基础资料车辆信息中，不能增加到办公用车')
}

export const officeVehicleStore = {
  refreshStatuses,
  async ensureVehiclesFromRegulatoryFees(vehicles: Array<{ plateNo: string, area?: string }>) {
    const transportBaseVehicleKeys = await getTransportBaseVehicleKeys()
    return Promise.all(vehicles.map(vehicle => this.ensureVehicleFromRegulatoryFee(vehicle.plateNo, vehicle.area, transportBaseVehicleKeys)))
  },
  async ensureVehicleFromRegulatoryFee(plateNo: string, area?: string, transportBaseVehicleKeys?: ReadonlySet<string>) {
    const normalizedPlateNo = normalizePlateNo(plateNo)
    if (!normalizedPlateNo)
      return undefined

    const syncTask = regulatoryVehicleSyncQueue.then(async () => {
      await hydrateOfficeVehicleState()
      const existing = state.vehicles.find(item => !item.deletedAt && item.plateNo === normalizedPlateNo)
      if (existing)
        return existing
      if (await isTransportBaseVehicle(normalizedPlateNo, transportBaseVehicleKeys))
        return undefined

      try {
        return await this.saveVehicle({
          plateNo: normalizedPlateNo,
          vehicleType: '办公用车',
          brandModel: '待补充',
          departmentName: area?.trim() || '待分配',
          ownerName: '待分配',
          status: '正常',
          remark: '由规费管理自动带入，请补充车辆基础资料',
        }, { userId: 'system', userName: '规费管理', roles: ['ADMIN'] })
      }
      catch (error) {
        if (!(error instanceof Error) || error.message !== '车牌号不能重复')
          throw error
        await hydrateOfficeVehicleState()
        const duplicate = state.vehicles.find(item => !item.deletedAt && item.plateNo === normalizedPlateNo)
        if (!duplicate)
          throw error
        return duplicate
      }
    })
    regulatoryVehicleSyncQueue = syncTask.then(() => undefined, () => undefined)
    return syncTask
  },
  async listVehicles(query: OfficeVehicleQuery = {}) {
    await hydrateOfficeVehicleState()
    refreshStatuses()
    const records = state.vehicles
      .filter(item => !item.deletedAt && canViewVehicle(item, query))
      .filter(item => !query.plateNo || item.plateNo.includes(String(query.plateNo)))
      .filter(item => !query.departmentName || item.departmentName === query.departmentName)
      .filter(item => !query.status || item.status === query.status)
      .map(item => ({
        ...presentRecord('vehicle', item, query),
        monthExpense: state.expenses.filter(expense => !expense.deletedAt && expense.vehicleId === item.id && inRange(expense.occurredDate, query)).reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
        riskCount: [
          ...state.licenses.filter(record => !record.deletedAt && record.vehicleId === item.id),
          ...state.insurances.filter(record => !record.deletedAt && record.vehicleId === item.id),
        ].filter(record => ['即将到期', '已过期'].includes(record.status || '')).length,
      }))
    return page(records, query)
  },
  async getVehicle(id: string, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    refreshStatuses()
    const vehicle = vehicleById(id)
    if (!canViewVehicle(vehicle, context))
      throw new Error('无权查看该车辆')
    return {
      vehicle: presentRecord('vehicle', vehicle, context),
      expenses: state.expenses.filter(item => !item.deletedAt && item.vehicleId === id).map(item => presentRecord('expense', item, context)),
      licenses: state.licenses.filter(item => !item.deletedAt && item.vehicleId === id).map(item => presentRecord('license', item, context)),
      insurances: state.insurances.filter(item => !item.deletedAt && item.vehicleId === id).map(item => presentRecord('insurance', item, context)),
      reminders: state.reminders.filter(item => !item.deletedAt && item.vehicleId === id).map(item => presentRecord('reminder', item, context)),
      logs: state.logs.filter(item => item.recordId === id || [item.recordId].includes(id)),
    }
  },
  async saveVehicle(payload: Partial<OfficeVehicle>, context: OperatorContext = {}, options: MutationOptions = {}) {
    payload = withoutRecordPermissions(payload as Record<string, any>)
    if (options.hydrate !== false)
      await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    if (!payload.plateNo?.trim())
      throw new Error('车牌号不能为空')
    if (!payload.brandModel?.trim())
      throw new Error('品牌型号不能为空')
    const normalizedPlateNo = normalizePlateNo(payload.plateNo)
    await assertNotTransportBaseVehicle(normalizedPlateNo)
    const duplicate = state.vehicles.some(item => !item.deletedAt && item.id !== payload.id && plateNoKey(item.plateNo) === plateNoKey(normalizedPlateNo))
    if (duplicate)
      throw new Error('车牌号不能重复')
    if (payload.id) {
      const index = state.vehicles.findIndex(item => item.id === payload.id && !item.deletedAt)
      if (index < 0)
        throw new Error('车辆不存在')
      state.vehicles[index] = { ...state.vehicles[index], ...payload, plateNo: normalizedPlateNo, updatedAt: now() } as OfficeVehicle
      addLog('vehicle', payload.id, 'UPDATE', `编辑车辆 ${normalizedPlateNo}`, context)
      if (options.persist !== false)
        await persist()
      return state.vehicles[index]
    }
    const record: OfficeVehicle = {
      id: nextId('veh'),
      plateNo: normalizedPlateNo,
      vehicleType: payload.vehicleType || '轿车',
      brandModel: payload.brandModel,
      departmentId: payload.departmentId,
      departmentName: payload.departmentName || '-',
      ownerUserId: payload.ownerUserId,
      ownerName: payload.ownerName || '-',
      defaultDriverId: payload.defaultDriverId,
      defaultDriverName: payload.defaultDriverName,
      status: payload.status || '正常',
      purchaseDate: payload.purchaseDate,
      photoUrl: payload.photoUrl,
      remark: payload.remark,
      createdBy: context.userId,
      createdAt: now(),
      updatedAt: now(),
    }
    state.vehicles.unshift(record)
    addLog('vehicle', record.id, 'CREATE', `新增车辆 ${record.plateNo}`, context)
    if (options.persist !== false)
      await persist()
    return presentRecord('vehicle', record, context)
  },
  async saveBatch(payload: OfficeVehicleBatchSavePayload, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    if (!payload?.vehicle)
      throw new Error('请填写车辆基础资料')

    const snapshot = snapshotState()
    const deferred: MutationOptions = { hydrate: false, persist: false }
    try {
      const vehicle = await this.saveVehicle(payload.vehicle, context, deferred)
      const vehicleId = vehicle.id
      const expenses: OfficeVehicleExpense[] = []
      const licenses: OfficeVehicleLicense[] = []
      const insurances: OfficeVehicleInsurance[] = []
      const reminders: OfficeVehicleReminder[] = []

      for (const [index, item] of (payload.expenses || []).entries()) {
        try {
          expenses.push(await this.saveExpense({ ...item, vehicleId }, context, deferred))
        }
        catch (error) {
          throw batchItemError('费用', index, error)
        }
      }
      for (const [index, item] of (payload.licenses || []).entries()) {
        try {
          licenses.push(await this.saveLicense({ ...item, vehicleId }, context, deferred))
        }
        catch (error) {
          throw batchItemError('证照', index, error)
        }
      }
      for (const [index, item] of (payload.insurances || []).entries()) {
        try {
          insurances.push(await this.saveInsurance({ ...item, vehicleId }, context, deferred))
        }
        catch (error) {
          throw batchItemError('保险', index, error)
        }
      }
      for (const [index, item] of (payload.reminders || []).entries()) {
        try {
          reminders.push(await this.saveReminder({ ...item, vehicleId }, context, deferred))
        }
        catch (error) {
          throw batchItemError('到期事项', index, error)
        }
      }

      await persist()
      return { vehicle, expenses, licenses, insurances, reminders }
    }
    catch (error) {
      restoreState(snapshot)
      throw error
    }
  },
  async deleteVehicle(id: string, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    const vehicle = vehicleById(id)
    const hasRelatedRecords = [state.expenses, state.licenses, state.insurances, state.reminders]
      .some(records => records.some(item => !item.deletedAt && item.vehicleId === id))
    if (hasRelatedRecords)
      throw new Error('车辆存在关联业务记录，不能删除')
    vehicle.deletedAt = now()
    vehicle.updatedAt = now()
    addLog('vehicle', id, 'DELETE', `删除车辆 ${vehicle.plateNo}`, context)
    await persist()
    return vehicle
  },
  async listExpenses(query: OfficeVehicleQuery = {}) {
    await hydrateOfficeVehicleState()
    refreshStatuses()
    const ids = visibleVehicleIds(query)
    const records = state.expenses
      .filter(item => !item.deletedAt && ids.has(item.vehicleId))
      .filter(item => !query.vehicleId || item.vehicleId === query.vehicleId)
      .filter(item => !query.plateNo || item.plateNo.includes(String(query.plateNo)))
      .filter(item => !query.expenseType || item.expenseType === query.expenseType)
      .filter(item => !query.departmentName || item.departmentName === query.departmentName)
      .filter(item => !query.status || item.approvalStatus === query.status)
      .filter(item => inRange(item.occurredDate, query))
      .sort((a, b) => dayjs(b.occurredDate).valueOf() - dayjs(a.occurredDate).valueOf())
    return page(records.map(item => presentRecord('expense', item, query)), query)
  },
  async saveExpense(payload: Partial<OfficeVehicleExpense>, context: OperatorContext = {}, options: MutationOptions = {}) {
    payload = withoutRecordPermissions(payload as Record<string, any>)
    if (options.hydrate !== false)
      await hydrateOfficeVehicleState()
    assertFinanceOrAdmin(context)
    if (!payload.vehicleId)
      throw new Error('请选择车辆')
    const vehicle = vehicleById(payload.vehicleId)
    const amount = Number(payload.amount ?? 0)
    if (!Number.isFinite(amount) || amount < 0)
      throw new Error('费用金额必须为有效的非负数')
    if (!payload.expenseType)
      throw new Error('费用类型不能为空')
    if (!payload.occurredDate)
      throw new Error('发生日期不能为空')
    const approvalStatus: ExpenseStatus = payload.needApproval ? (payload.approvalStatus || '草稿') : '已确认'
    if (payload.id) {
      const index = state.expenses.findIndex(item => item.id === payload.id && !item.deletedAt)
      if (index < 0)
        throw new Error('费用记录不存在')
      if (state.expenses[index].approvalStatus === '已确认')
        throw new Error('已确认费用不能编辑')
      state.expenses[index] = { ...state.expenses[index], ...payload, plateNo: vehicle.plateNo, approvalStatus, updatedAt: now() } as OfficeVehicleExpense
      addLog('expense', payload.id, 'UPDATE', `编辑费用 ${vehicle.plateNo} ${payload.expenseType}`, context)
      if (options.persist !== false)
        await persist()
      return state.expenses[index]
    }
    const record: OfficeVehicleExpense = {
      id: nextId('exp'),
      vehicleId: payload.vehicleId,
      plateNo: vehicle.plateNo,
      expenseType: payload.expenseType,
      amount,
      occurredDate: payload.occurredDate,
      handlerId: payload.handlerId || context.userId,
      handlerName: payload.handlerName || context.userName || '超级管理员',
      departmentId: payload.departmentId || vehicle.departmentId,
      departmentName: payload.departmentName || vehicle.departmentName,
      paymentMethod: payload.paymentMethod || '企业微信',
      invoiceNo: payload.invoiceNo,
      attachmentName: payload.attachmentName,
      attachmentUrl: payload.attachmentUrl,
      needApproval: Boolean(payload.needApproval),
      approvalStatus,
      remark: payload.remark,
      createdBy: context.userId,
      createdAt: now(),
      updatedAt: now(),
    }
    state.expenses.unshift(record)
    addLog('expense', record.id, 'CREATE', `新增费用 ${record.plateNo} ${record.expenseType} ${record.amount} 元`, context)
    if (options.persist !== false)
      await persist()
    return presentRecord('expense', record, context)
  },
  async deleteExpense(id: string, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertFinanceOrAdmin(context)
    const record = state.expenses.find(item => item.id === id && !item.deletedAt)
    if (!record)
      throw new Error('费用记录不存在')
    if (['已确认', '审批中'].includes(record.approvalStatus))
      throw new Error('已确认或审批中的费用不能删除')
    record.deletedAt = now()
    record.updatedAt = now()
    addLog('expense', id, 'DELETE', `删除费用 ${record.plateNo} ${record.expenseType}`, context)
    await persist()
    return record
  },
  async submitExpenseApproval(id: string, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertFinanceOrAdmin(context)
    const record = state.expenses.find(item => item.id === id && !item.deletedAt)
    if (!record)
      throw new Error('费用记录不存在')
    if (['审批中', '已确认'].includes(record.approvalStatus))
      throw new Error('该费用已提交审批或已确认')
    const detail = await approvalStore.submit({
      businessType: 'office_vehicle_expense',
      businessId: record.id,
      businessNo: record.id,
      title: `办公用车费用审批-${record.plateNo}-${record.expenseType}`,
      applicantId: context.userId || record.handlerId || 1,
      applicantName: context.userName || record.handlerName,
      deptId: context.deptId || record.departmentId,
      deptName: context.deptName || record.departmentName,
      amount: record.amount,
      formData: record,
    })
    record.needApproval = true
    record.approvalStatus = '审批中'
    record.approvalInstanceId = detail.instance.id
    record.updatedAt = now()
    addLog('expense', id, 'SUBMIT_APPROVAL', `提交 OA 审批 ${detail.instance.code}`, context)
    await persist()
    return record
  },
  async confirmExpense(id: string, status: Extract<ExpenseStatus, '已确认' | '已驳回' | '已撤回'>, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertFinanceOrAdmin(context)
    assertStatusValue(status, ['已确认', '已驳回', '已撤回'], '费用状态')
    const record = state.expenses.find(item => item.id === id && !item.deletedAt)
    if (!record)
      throw new Error('费用记录不存在')
    assertStatusTransition(record.approvalStatus, status, expenseApprovalTransitions, '费用状态')
    record.approvalStatus = status
    record.updatedAt = now()
    addLog('expense', id, status === '已确认' ? 'CONFIRM' : 'CHANGE_STATUS', `费用状态变更为${status}`, context)
    await persist()
    return record
  },
  async listLicenses(query: OfficeVehicleQuery = {}) {
    await hydrateOfficeVehicleState()
    refreshStatuses()
    const ids = visibleVehicleIds(query)
    const records = state.licenses
      .filter(item => !item.deletedAt && ids.has(item.vehicleId))
      .filter(item => !query.vehicleId || item.vehicleId === query.vehicleId)
      .filter(item => !query.licenseType || item.licenseType === query.licenseType)
      .filter(item => !query.status || item.status === query.status)
    return page(records.map(item => presentRecord('license', item, query)), query)
  },
  async saveLicense(payload: Partial<OfficeVehicleLicense>, context: OperatorContext = {}, options: MutationOptions = {}) {
    payload = withoutRecordPermissions(payload as Record<string, any>)
    if (options.hydrate !== false)
      await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    if (!payload.vehicleId)
      throw new Error('请选择车辆')
    if (!payload.licenseType)
      throw new Error('证照类型不能为空')
    if (!payload.licenseNo)
      throw new Error('证照编号不能为空')
    if (!payload.expiryDate)
      throw new Error('到期日期不能为空')
    if (payload.issueDate && dayjs(payload.expiryDate).isBefore(dayjs(payload.issueDate), 'day'))
      throw new Error('证照到期日期不能早于签发日期')
    const vehicle = vehicleById(payload.vehicleId)
    const base = { ...payload, plateNo: vehicle.plateNo, status: resolveLicenseStatus(payload.expiryDate), updatedAt: now() } as OfficeVehicleLicense
    if (payload.id) {
      const index = state.licenses.findIndex(item => item.id === payload.id && !item.deletedAt)
      if (index < 0)
        throw new Error('证照不存在')
      state.licenses[index] = { ...state.licenses[index], ...base }
      addLog('license', payload.id, 'UPDATE', `编辑证照 ${base.licenseType}`, context)
      if (options.persist !== false)
        await persist()
      return state.licenses[index]
    }
    const record: OfficeVehicleLicense = { ...base, id: nextId('lic'), createdBy: context.userId, createdAt: now() }
    state.licenses.unshift(record)
    addLog('license', record.id, 'CREATE', `上传证照 ${record.licenseType}`, context)
    if (options.persist !== false)
      await persist()
    return record
  },
  async deleteLicense(id: string, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    const record = state.licenses.find(item => item.id === id && !item.deletedAt)
    if (!record)
      throw new Error('证照不存在')
    record.deletedAt = now()
    record.updatedAt = now()
    addLog('license', id, 'DELETE', `删除证照 ${record.licenseType}`, context)
    await persist()
    return record
  },
  async listInsurances(query: OfficeVehicleQuery = {}) {
    await hydrateOfficeVehicleState()
    refreshStatuses()
    const ids = visibleVehicleIds(query)
    const records = state.insurances
      .filter(item => !item.deletedAt && ids.has(item.vehicleId))
      .filter(item => !query.vehicleId || item.vehicleId === query.vehicleId)
      .filter(item => !query.insuranceType || item.insuranceType === query.insuranceType)
      .filter(item => !query.status || item.status === query.status)
    return page(records.map(item => presentRecord('insurance', item, query)), query)
  },
  async saveInsurance(payload: Partial<OfficeVehicleInsurance>, context: OperatorContext = {}, options: MutationOptions = {}) {
    payload = withoutRecordPermissions(payload as Record<string, any>)
    if (options.hydrate !== false)
      await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    if (!payload.vehicleId)
      throw new Error('请选择车辆')
    if (!payload.insuranceType)
      throw new Error('保险类型不能为空')
    if (!payload.policyNo)
      throw new Error('保单号不能为空')
    if (!payload.startDate || !payload.endDate)
      throw new Error('保险起止日期不能为空')
    const amount = Number(payload.amount ?? 0)
    if (!Number.isFinite(amount) || amount < 0)
      throw new Error('保险金额必须为有效的非负数')
    if (dayjs(payload.endDate).isBefore(dayjs(payload.startDate), 'day'))
      throw new Error('保险结束日期不能早于开始日期')
    const vehicle = vehicleById(payload.vehicleId)
    const base = { ...payload, plateNo: vehicle.plateNo, status: resolveLicenseStatus(payload.endDate), updatedAt: now() } as OfficeVehicleInsurance
    if (payload.id) {
      const index = state.insurances.findIndex(item => item.id === payload.id && !item.deletedAt)
      if (index < 0)
        throw new Error('保险信息不存在')
      state.insurances[index] = { ...state.insurances[index], ...base }
      addLog('insurance', payload.id, 'UPDATE', `编辑保险 ${base.insuranceType}`, context)
      if (options.persist !== false)
        await persist()
      return state.insurances[index]
    }
    const record: OfficeVehicleInsurance = { ...base, id: nextId('ins'), amount, insurer: payload.insurer || '-', createdBy: context.userId, createdAt: now() }
    state.insurances.unshift(record)
    addLog('insurance', record.id, 'CREATE', `新增保险 ${record.insuranceType}`, context)
    if (options.persist !== false)
      await persist()
    return record
  },
  async listReminders(query: OfficeVehicleQuery = {}) {
    await hydrateOfficeVehicleState()
    refreshStatuses()
    const ids = visibleVehicleIds(query)
    const records = state.reminders
      .filter(item => !item.deletedAt && ids.has(item.vehicleId))
      .filter(item => !query.vehicleId || item.vehicleId === query.vehicleId)
      .filter(item => !query.reminderType || item.reminderType === query.reminderType)
      .filter(item => !query.status || item.status === query.status)
      .sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf())
    return page(records.map(item => presentRecord('reminder', item, query)), query)
  },
  async saveReminder(payload: Partial<OfficeVehicleReminder>, context: OperatorContext = {}, options: MutationOptions = {}) {
    payload = withoutRecordPermissions(payload as Record<string, any>)
    if (options.hydrate !== false)
      await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    if (!payload.vehicleId)
      throw new Error('请选择车辆')
    if (!payload.reminderType?.trim())
      throw new Error('请选择事项类型')
    if (!payload.dueDate)
      throw new Error('请选择到期或保养日期')
    const remindDays = Number(payload.remindDays ?? 30)
    if (!Number.isInteger(remindDays) || remindDays < 0 || remindDays > 365)
      throw new Error('提前提醒天数必须是 0 到 365 的整数')
    const vehicle = vehicleById(payload.vehicleId)
    const sourceType = payload.reminderType.includes('保险')
      ? 'insurance'
      : payload.reminderType.includes('保养') ? 'maintenance' : 'license'
    const targetNames = Array.isArray(payload.targetNames) && payload.targetNames.length
      ? payload.targetNames.map(String).map(item => item.trim()).filter(Boolean)
      : [vehicle.ownerName || vehicle.departmentName || '车辆负责人']
    const base = {
      ...payload,
      plateNo: vehicle.plateNo,
      remindDays,
      targetUserIds: Array.isArray(payload.targetUserIds) ? payload.targetUserIds : [],
      targetNames,
      status: resolveDueStatus(payload.dueDate, remindDays),
      handled: Boolean(payload.handled),
      sourceType,
      updatedAt: now(),
    } as OfficeVehicleReminder
    if (payload.id) {
      const index = state.reminders.findIndex(item => item.id === payload.id && !item.deletedAt)
      if (index < 0)
        throw new Error('到期事项不存在')
      state.reminders[index] = { ...state.reminders[index], ...base }
      addLog('reminder', payload.id, 'UPDATE', `编辑到期事项 ${base.reminderType}`, context)
      if (options.persist !== false)
        await persist()
      return state.reminders[index]
    }
    const record: OfficeVehicleReminder = {
      ...base,
      id: nextId('rem'),
      handled: false,
      createdBy: context.userId,
      createdAt: now(),
    }
    state.reminders.unshift(record)
    addLog('reminder', record.id, 'CREATE', `新增到期事项 ${record.plateNo} ${record.reminderType}`, context)
    if (options.persist !== false)
      await persist()
    return record
  },
  async deleteReminder(id: string, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertOfficeAdmin(context)
    const record = state.reminders.find(item => item.id === id && !item.deletedAt)
    if (!record)
      throw new Error('到期事项不存在')
    record.deletedAt = now()
    record.updatedAt = now()
    addLog('reminder', id, 'DELETE', `删除到期事项 ${record.plateNo} ${record.reminderType}`, context)
    await persist()
    return record
  },
  async handleReminder(id: string, payload: { handleRemark?: string }, context: OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    assertFinanceOrAdmin(context)
    const record = state.reminders.find(item => item.id === id && !item.deletedAt)
    if (!record)
      throw new Error('提醒不存在')
    record.handled = true
    record.status = '已处理'
    record.handledAt = now()
    record.handleRemark = payload.handleRemark
    record.updatedAt = now()
    addLog('reminder', id, 'HANDLE', `处理提醒 ${record.reminderType}`, context)
    await persist()
    return record
  },
  async summary(query: OfficeVehicleQuery = {}) {
    refreshStatuses()
    const vehicles = (await this.listVehicles({ ...query, current: 1, pageSize: 100000 })).records
    const expenses = (await this.listExpenses({ ...query, current: 1, pageSize: 100000 })).records
    const licenses = (await this.listLicenses({ ...query, current: 1, pageSize: 100000 })).records
    const insurances = (await this.listInsurances({ ...query, current: 1, pageSize: 100000 })).records
    const expiryRecords = [...licenses, ...insurances]
    const totalExpense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const approvalTotalAmount = expenses
      .filter(item => ['待审批', '审批中', '已确认'].includes(item.approvalStatus))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const usedAmount = expenses
      .filter(item => item.approvalStatus === '已确认')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const byVehicle = vehicles.map(vehicle => ({
      vehicleId: vehicle.id,
      plateNo: vehicle.plateNo,
      brandModel: vehicle.brandModel,
      amount: expenses.filter(expense => expense.vehicleId === vehicle.id).reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    })).sort((a, b) => b.amount - a.amount)
    const byMonth = Object.values(expenses.reduce<Record<string, { month: string, amount: number }>>((target, item) => {
      const month = dayjs(item.occurredDate).format('YYYY-MM')
      target[month] ||= { month, amount: 0 }
      target[month].amount += Number(item.amount || 0)
      return target
    }, {})).sort((a, b) => a.month.localeCompare(b.month))
    return {
      vehicleCount: vehicles.length,
      monthExpense: totalExpense,
      approvalTotalAmount,
      usedAmount,
      upcomingReminderCount: expiryRecords.filter(item => item.status === '即将到期').length,
      expiredReminderCount: expiryRecords.filter(item => item.status === '已过期').length,
      confirmedExpense: expenses.filter(item => item.approvalStatus === '已确认').reduce((sum, item) => sum + Number(item.amount || 0), 0),
      pendingExpenseCount: expenses.filter(item => ['待审批', '审批中'].includes(item.approvalStatus)).length,
      byVehicle,
      byMonth,
    }
  },
  async exportExpenses(query: OfficeVehicleQuery = {}) {
    const expenses = (await this.listExpenses({ ...query, current: 1, pageSize: 100000 })).records
    return expenses.map(item => ({
      车牌号: item.plateNo,
      费用类型: item.expenseType,
      费用金额: item.amount,
      发生日期: item.occurredDate,
      经办人: item.handlerName,
      所属部门: item.departmentName,
      支付方式: item.paymentMethod,
      发票号: item.invoiceNo || '',
      票据附件: item.attachmentName || '',
      是否需要审批: item.needApproval ? '是' : '否',
      审批状态: item.approvalStatus,
      备注: item.remark || '',
    }))
  },
  async listLogs(query: { recordId?: string } & OperatorContext = {}) {
    await hydrateOfficeVehicleState()
    const visibleIds = visibleVehicleIds(query)
    const visibleRecordIds = new Set<string>(visibleIds)
    for (const records of [state.expenses, state.licenses, state.insurances, state.reminders]) {
      records.filter(item => visibleIds.has(item.vehicleId)).forEach(item => visibleRecordIds.add(item.id))
    }
    return state.logs.filter(item => visibleRecordIds.has(item.recordId) && (!query.recordId || item.recordId === query.recordId))
  },
}
