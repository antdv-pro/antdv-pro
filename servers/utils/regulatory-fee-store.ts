import type mysql from 'mysql2/promise'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import dayjs from 'dayjs'
import { assertStatusTransition, assertStatusValue, manualEnableTransitions } from '../services/vehicle-business/workflow'
import { registerApprovalBusinessHandler } from './approval-callback-dispatcher'
import { approvalStore } from './approval-store'
import { resolveJsonDataFile } from './data-paths'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { officeVehicleStore } from './office-vehicle-store'

export type RegulatoryFeeManualStatus = 'enabled' | 'disabled'
export type RegulatoryFeeStatus = '未开始' | '生效中' | '已截止' | '停用'
export type RegulatoryFeeApprovalStatus = '草稿' | '审批中' | '已确认' | '已驳回' | '已撤回'

export interface RegulatoryFeeRecord {
  id: number
  feeName: string
  feeType: string
  plateNo?: string
  trailerNo?: string
  area?: string
  totalAmount: number
  validStartDate: string
  validEndDate: string
  validMonths: number
  monthlyAmortizedAmount: number
  manualStatus: RegulatoryFeeManualStatus
  status: RegulatoryFeeStatus
  approvalStatus?: RegulatoryFeeApprovalStatus
  approvalInstanceId?: string
  approvedAt?: string
  rejectedAt?: string
  revokedAt?: string
  remark?: string
  attachmentName?: string
  attachmentUrl?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  createdBy?: string | number
  permissions?: {
    view?: boolean | { allowed: boolean, reason?: string }
    edit?: boolean | { allowed: boolean, reason?: string }
    delete?: boolean | { allowed: boolean, reason?: string }
    audit?: boolean | { allowed: boolean, reason?: string }
    revoke?: boolean | { allowed: boolean, reason?: string }
    void?: boolean | { allowed: boolean, reason?: string }
    confirmImport?: boolean | { allowed: boolean, reason?: string }
  }
}

export interface RegulatoryFeePayload {
  feeName?: string
  feeType: string
  plateNo?: string
  trailerNo?: string
  area?: string
  totalAmount: number
  validStartDate: string
  validEndDate: string
  remark?: string
  attachmentName?: string
  attachmentUrl?: string
}

export interface RegulatoryFeeQuery {
  current?: number
  pageSize?: number
  plateNo?: string
  trailerNo?: string
  startDate?: string
  endDate?: string
  financialYear?: number | string
  financialMonth?: number | string
  feeType?: string
  status?: RegulatoryFeeStatus
}

export interface RegulatoryFeeOverviewQuery {
  plateNo?: string
  upcomingOnly?: boolean
  startDate?: string
  endDate?: string
  financialYear?: number | string
  financialMonth?: number | string
}

export interface RegulatoryFeeOverviewRow {
  id: number
  plateNo: string
  area: string
  trafficInsurance?: string
  ownerCommercialInsurance?: string
  trailerCommercialInsurance?: string
  vehicleAccidentInsurance?: string
  carrierLiabilityInsurance?: string
  gpsFee?: string
  ownerDrivingPermit?: string
  trailerDrivingPermit?: string
  cylinderYearCheck?: string
  tankCheck?: string
  safetyValveYearCheck?: string
  pressureGaugeCalibration?: string
}

const DATE_FORMAT = 'YYYY-MM-DD'
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
const overviewDateFields = [
  'trafficInsurance',
  'ownerCommercialInsurance',
  'trailerCommercialInsurance',
  'vehicleAccidentInsurance',
  'carrierLiabilityInsurance',
  'gpsFee',
  'ownerDrivingPermit',
  'trailerDrivingPermit',
  'cylinderYearCheck',
  'tankCheck',
  'safetyValveYearCheck',
  'pressureGaugeCalibration',
] as const
const overviewFeeNameFieldMap: Record<string, keyof RegulatoryFeeOverviewRow> = {
  交强险: 'trafficInsurance',
  主车商业险: 'ownerCommercialInsurance',
  挂车商业险: 'trailerCommercialInsurance',
  车辆意外险: 'vehicleAccidentInsurance',
  承运人责任险: 'carrierLiabilityInsurance',
  GPS年费: 'gpsFee',
  主车行驶证: 'ownerDrivingPermit',
  挂车行驶证: 'trailerDrivingPermit',
  气瓶年审: 'cylinderYearCheck',
  罐体检测: 'tankCheck',
  安全阀年检: 'safetyValveYearCheck',
  压力表校验: 'pressureGaugeCalibration',
}

const initialFeeStore: RegulatoryFeeRecord[] = [
  buildRecord({
    id: 1,
    feeName: '主车商业险',
    feeType: '保险费',
    plateNo: '沪A·3589',
    area: '上海',
    totalAmount: 5800,
    validStartDate: '2026-01-01',
    validEndDate: '2026-12-31',
    manualStatus: 'enabled',
    remark: '沪A.3589 年度商业险',
    createdAt: '2026-01-01 09:00:00',
    updatedAt: '2026-01-01 09:00:00',
    createdBy: 1,
  }),
  buildRecord({
    id: 2,
    feeName: '主车行驶证',
    feeType: '年审费',
    plateNo: '苏E·2198',
    area: '江苏苏州',
    totalAmount: 680,
    validStartDate: '2026-07-01',
    validEndDate: '2027-06-30',
    manualStatus: 'enabled',
    remark: '苏E.2198 主车行驶证年审',
    createdAt: '2026-07-01 10:20:00',
    updatedAt: '2026-07-01 10:20:00',
    createdBy: 1,
  }),
  buildRecord({
    id: 3,
    feeName: 'GPS年费',
    feeType: '停车费',
    plateNo: '沪A·3589',
    area: '上海',
    totalAmount: 1200,
    validStartDate: '2026-06-01',
    validEndDate: '2026-08-31',
    manualStatus: 'disabled',
    remark: '临时停用，等待场地方确认',
    createdAt: '2026-06-01 11:00:00',
    updatedAt: '2026-06-10 16:35:00',
    createdBy: 2,
  }),
]

const globalStore = globalThis as any
const dataFile = resolveJsonDataFile('regulatory-fees.json')

function readDataFile() {
  if (!existsSync(dataFile))
    return undefined

  try {
    return JSON.parse(readFileSync(dataFile, 'utf-8')) as RegulatoryFeeRecord[]
  }
  catch {
    return undefined
  }
}

function writeDataFile(records: RegulatoryFeeRecord[]) {
  mkdirSync(dirname(dataFile), { recursive: true })
  writeFileSync(dataFile, JSON.stringify(records, null, 2))
}

if (!globalStore.__regulatoryFeeStore) {
  globalStore.__regulatoryFeeStore = isDatabaseRequired() ? [] : (readDataFile() || initialFeeStore)
  globalStore.__regulatoryFeeNextId = 4
}

const feeStore = globalStore.__regulatoryFeeStore as RegulatoryFeeRecord[]
let hydrationPromise: Promise<RegulatoryFeeRecord[]> | undefined
let hydrated = false

if (!isDatabaseRequired() && !getMysqlPool() && !existsSync(dataFile))
  writeDataFile(feeStore)

function syncStoreFromDisk() {
  const diskStore = readDataFile()
  if (diskStore) {
    feeStore.splice(0, feeStore.length, ...diskStore)
    globalStore.__regulatoryFeeNextId = Math.max(0, ...feeStore.map(item => item.id)) + 1
  }
  return feeStore
}

async function persistStore() {
  if (getMysqlPool())
    await persistStoreToMysql()
  else
    writeDataFile(feeStore)
}

function formatDate(value: unknown) {
  if (!value)
    return ''
  return dayjs(value as any).format(DATE_FORMAT)
}

function formatDateTime(value: unknown) {
  if (!value)
    return ''
  return dayjs(value as any).format(DATE_TIME_FORMAT)
}

interface RegulatoryFeeDbRow {
  id: number
  fee_name: string
  fee_type: string
  plate_no: string | null
  trailer_no: string | null
  area: string | null
  total_amount: string | number
  valid_start_date: Date | string
  valid_end_date: Date | string
  valid_months: number
  monthly_amortized_amount: string | number
  manual_status: RegulatoryFeeManualStatus
  approval_status: RegulatoryFeeApprovalStatus | null
  approval_instance_id: string | null
  approved_at: Date | string | null
  rejected_at: Date | string | null
  revoked_at: Date | string | null
  remark: string | null
  attachment_name: string | null
  attachment_url: string | null
  created_by: string | number | null
  created_at: Date | string
  updated_at: Date | string
  deleted_at: Date | string | null
}

function mapRegulatoryFeeRow(row: RegulatoryFeeDbRow): RegulatoryFeeRecord {
  return buildRecord({
    id: Number(row.id),
    feeName: row.fee_name,
    feeType: row.fee_type,
    plateNo: row.plate_no || undefined,
    trailerNo: row.trailer_no || undefined,
    area: row.area || undefined,
    totalAmount: Number(row.total_amount || 0),
    validStartDate: formatDate(row.valid_start_date),
    validEndDate: formatDate(row.valid_end_date),
    manualStatus: row.manual_status || 'enabled',
    approvalStatus: row.approval_status || '草稿',
    approvalInstanceId: row.approval_instance_id || undefined,
    approvedAt: row.approved_at ? formatDateTime(row.approved_at) : undefined,
    rejectedAt: row.rejected_at ? formatDateTime(row.rejected_at) : undefined,
    revokedAt: row.revoked_at ? formatDateTime(row.revoked_at) : undefined,
    remark: row.remark || undefined,
    attachmentName: row.attachment_name || undefined,
    attachmentUrl: row.attachment_url || undefined,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    deletedAt: row.deleted_at ? formatDateTime(row.deleted_at) : undefined,
    createdBy: row.created_by || undefined,
  })
}

async function ensureRegulatoryFeeSchema(db: mysql.Pool) {
  await db.query(`
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
      attachment_name VARCHAR(255) NULL,
      attachment_url VARCHAR(512) NULL,
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      deleted_at DATETIME NULL,
      KEY idx_regulatory_fee_valid_date (valid_start_date, valid_end_date),
      KEY idx_regulatory_fee_type (fee_type),
      KEY idx_regulatory_fee_plate_no (plate_no),
      KEY idx_regulatory_fee_approval (approval_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureRegulatoryFeeColumn(db, 'attachment_name', 'VARCHAR(255) NULL')
  await ensureRegulatoryFeeColumn(db, 'attachment_url', 'VARCHAR(512) NULL')
}

async function ensureRegulatoryFeeColumn(db: mysql.Pool, column: string, definition: string) {
  try {
    await db.query(`ALTER TABLE regulatory_fee ADD COLUMN ${column} ${definition}`)
  }
  catch {}
}

async function loadStoreFromMysql() {
  const db = getMysqlPool()
  if (!db)
    return false

  await ensureRegulatoryFeeSchema(db)

  const [rows] = await db.query<mysql.RowDataPacket[]>(`
    SELECT id, fee_name, fee_type, plate_no, trailer_no, area, total_amount,
      valid_start_date, valid_end_date, valid_months, monthly_amortized_amount,
      manual_status, approval_status, approval_instance_id, approved_at, rejected_at,
      revoked_at, remark, attachment_name, attachment_url, created_by, created_at, updated_at, deleted_at
    FROM regulatory_fee
    ORDER BY created_at DESC, id DESC
  `)
  const records = (rows as unknown as RegulatoryFeeDbRow[]).map(mapRegulatoryFeeRow)
  if (!records.length) {
    if (!isDatabaseRequired())
      await persistStoreToMysql()
    else
      feeStore.splice(0, feeStore.length)
    return true
  }
  feeStore.splice(0, feeStore.length, ...records)
  globalStore.__regulatoryFeeNextId = Math.max(0, ...feeStore.map(item => item.id)) + 1
  return true
}

async function persistStoreToMysql() {
  const db = getMysqlPool()
  if (!db)
    return

  await ensureRegulatoryFeeSchema(db)

  await withMysqlTransaction(db, async (connection) => {
    for (const record of feeStore) {
      await connection.execute(`
      INSERT INTO regulatory_fee (
        id, fee_name, fee_type, plate_no, trailer_no, area, total_amount,
        valid_start_date, valid_end_date, valid_months, monthly_amortized_amount,
        manual_status, approval_status, approval_instance_id, approved_at,
        rejected_at, revoked_at, remark, attachment_name, attachment_url, created_by, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        fee_name = VALUES(fee_name),
        fee_type = VALUES(fee_type),
        plate_no = VALUES(plate_no),
        trailer_no = VALUES(trailer_no),
        area = VALUES(area),
        total_amount = VALUES(total_amount),
        valid_start_date = VALUES(valid_start_date),
        valid_end_date = VALUES(valid_end_date),
        valid_months = VALUES(valid_months),
        monthly_amortized_amount = VALUES(monthly_amortized_amount),
        manual_status = VALUES(manual_status),
        approval_status = VALUES(approval_status),
        approval_instance_id = VALUES(approval_instance_id),
        approved_at = VALUES(approved_at),
        rejected_at = VALUES(rejected_at),
        revoked_at = VALUES(revoked_at),
        remark = VALUES(remark),
        attachment_name = VALUES(attachment_name),
        attachment_url = VALUES(attachment_url),
        created_by = VALUES(created_by),
        created_at = VALUES(created_at),
        updated_at = VALUES(updated_at),
        deleted_at = VALUES(deleted_at)
    `, [
        record.id,
        record.feeName,
        record.feeType,
        record.plateNo || null,
        record.trailerNo || null,
        record.area || null,
        record.totalAmount,
        record.validStartDate,
        record.validEndDate,
        record.validMonths,
        record.monthlyAmortizedAmount,
        record.manualStatus,
        record.approvalStatus || '草稿',
        record.approvalInstanceId || null,
        record.approvedAt || null,
        record.rejectedAt || null,
        record.revokedAt || null,
        record.remark || null,
        record.attachmentName || null,
        record.attachmentUrl || null,
        record.createdBy == null ? null : String(record.createdBy),
        record.createdAt,
        record.updatedAt,
        record.deletedAt || null,
      ])
    }
  })
}

async function hydrateRegulatoryFeeStore() {
  if (hydrated)
    return feeStore
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      if (!(await loadStoreFromMysql()))
        syncStoreFromDisk()
      hydrated = true
      return feeStore
    })().finally(() => {
      hydrationPromise = undefined
    })
  }
  return hydrationPromise
}

function updateRegulatoryFeeApprovalFromCallback(instanceId: string, status: RegulatoryFeeApprovalStatus) {
  const record = feeStore.find(item => item.approvalInstanceId === instanceId && !item.deletedAt)
  if (!record || record.approvalStatus === status)
    return

  record.approvalStatus = status
  record.updatedAt = now()
  if (status === '已确认')
    record.approvedAt = now()
  else if (status === '已驳回')
    record.rejectedAt = now()
  else if (status === '已撤回')
    record.revokedAt = now()
  void persistStore()
}

registerApprovalBusinessHandler('transport_fee', {
  snapshot: () => JSON.parse(JSON.stringify(feeStore)),
  restore: (snapshot) => {
    feeStore.splice(0, feeStore.length, ...(snapshot as RegulatoryFeeRecord[]))
    void persistStore()
  },
  onPending: instance => updateRegulatoryFeeApprovalFromCallback(instance.id, '审批中'),
  onApproved: instance => updateRegulatoryFeeApprovalFromCallback(instance.id, '已确认'),
  onRejected: instance => updateRegulatoryFeeApprovalFromCallback(instance.id, '已驳回'),
  onRevoked: instance => updateRegulatoryFeeApprovalFromCallback(instance.id, '已撤回'),
})

function getNextId() {
  const id = Number(globalStore.__regulatoryFeeNextId || 1)
  globalStore.__regulatoryFeeNextId = id + 1
  return id
}

function now() {
  return dayjs().format(DATE_TIME_FORMAT)
}

function normalizePlateNo(value?: string) {
  return String(value || '').trim().replace('.', '·')
}

function buildImportDuplicateKey(record: Pick<RegulatoryFeePayload, 'feeType' | 'plateNo' | 'trailerNo' | 'validStartDate' | 'validEndDate'>) {
  return [
    String(record.feeType || '').trim(),
    normalizePlateNo(record.plateNo),
    normalizePlateNo(record.trailerNo),
    formatDate(record.validStartDate),
    formatDate(record.validEndDate),
  ].join('\u0001')
}

function describeImportRecord(record: Pick<RegulatoryFeePayload, 'feeType' | 'plateNo' | 'validStartDate' | 'validEndDate'>) {
  return `${normalizePlateNo(record.plateNo)} / ${String(record.feeType || '').trim()} / ${formatDate(record.validStartDate)}至${formatDate(record.validEndDate)}`
}

function extractPlateNo(record: Pick<RegulatoryFeeRecord, 'plateNo' | 'remark'>) {
  const plateNo = normalizePlateNo(record.plateNo)
  if (plateNo)
    return plateNo
  return normalizePlateNo(String(record.remark || '').match(/[A-Z\u4E00-\u9FA5]{0,2}[·.]?[A-Z0-9\u4E00-\u9FA5]{4,6}/)?.[0])
}

function isTrailerPlateNo(plateNo: string) {
  return /挂/.test(plateNo)
}

function resolveOverviewField(record: Pick<RegulatoryFeeRecord, 'feeName' | 'feeType'>): keyof RegulatoryFeeOverviewRow | undefined {
  const mappedField = overviewFeeNameFieldMap[record.feeType] || overviewFeeNameFieldMap[record.feeName]
  if (mappedField)
    return mappedField

  const text = `${record.feeName || ''}${record.feeType || ''}`
  if (/交强险/.test(text))
    return 'trafficInsurance'
  if (/挂车.*商业险|商业险.*挂车/.test(text))
    return 'trailerCommercialInsurance'
  if (/商业险|保险费|车辆保险/.test(text))
    return 'ownerCommercialInsurance'
  if (/意外险/.test(text))
    return 'vehicleAccidentInsurance'
  if (/承运人|责任险/.test(text))
    return 'carrierLiabilityInsurance'
  if (/GPS|gps/.test(text))
    return 'gpsFee'
  if (/挂车.*行驶证|行驶证.*挂车/.test(text))
    return 'trailerDrivingPermit'
  if (/行驶证/.test(text))
    return 'ownerDrivingPermit'
  if (/气瓶/.test(text))
    return 'cylinderYearCheck'
  if (/罐体/.test(text))
    return 'tankCheck'
  if (/安全阀/.test(text))
    return 'safetyValveYearCheck'
  if (/压力表/.test(text))
    return 'pressureGaugeCalibration'
  if (/年审|营运证|牌照/.test(text))
    return 'ownerDrivingPermit'
}

function isUpcomingOverviewDate(value?: string) {
  if (!value)
    return false
  return String(value).split('\n').some((item) => {
    const diff = dayjs(item).diff(dayjs(), 'day')
    return diff >= 0 && diff <= 90
  })
}

function isExpiredRecord(record: Pick<RegulatoryFeeRecord, 'validEndDate'>) {
  return dayjs(record.validEndDate).endOf('day').isBefore(dayjs())
}

function resolveStatisticsDateRange(query: RegulatoryFeeQuery = {}) {
  return resolveQueryDateRange(query) || {
    startDate: dayjs().startOf('month').format(DATE_FORMAT),
    endDate: dayjs().endOf('month').format(DATE_FORMAT),
  }
}

function financialMonthIndex(value: string) {
  const date = dayjs(value)
  const month = date.date() >= 26 ? date.add(1, 'month') : date
  return month.year() * 12 + month.month()
}

function countCoveredFinancialMonths(startDate: string, endDate: string) {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  if (!start.isValid() || !end.isValid() || end.isBefore(start))
    return 0
  return financialMonthIndex(endDate) - financialMonthIndex(startDate) + 1
}

function calculateAllocatedAmount(record: RegulatoryFeeRecord, query: RegulatoryFeeQuery = {}) {
  if (isExpiredRecord(record))
    return 0

  const range = resolveStatisticsDateRange(query)
  const recordStart = dayjs(record.validStartDate)
  const recordEnd = dayjs(record.validEndDate).add(1, 'day')
  const rangeStart = dayjs(range.startDate)
  const rangeEnd = dayjs(range.endDate)
  const overlapStart = recordStart.isAfter(rangeStart, 'day') ? recordStart : rangeStart
  const overlapEnd = recordEnd.isBefore(rangeEnd, 'day') ? recordEnd : rangeEnd
  if (!overlapEnd.isAfter(overlapStart, 'day'))
    return 0

  const months = countCoveredFinancialMonths(
    overlapStart.format(DATE_FORMAT),
    overlapEnd.subtract(1, 'day').format(DATE_FORMAT),
  )
  return Number((Number(record.monthlyAmortizedAmount || 0) * months).toFixed(2))
}

function roundAmount(value: number) {
  return Number(value.toFixed(2))
}

function resolveLatestOverviewDate(currentValue: unknown, nextValue: string) {
  const current = String(currentValue || '').trim()
  if (!current)
    return nextValue
  return dayjs(nextValue).isAfter(dayjs(current), 'day') ? nextValue : current
}

export function calculateValidMonths(validStartDate: string, validEndDate: string) {
  const start = dayjs(validStartDate)
  const end = dayjs(validEndDate)
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day'))
    return 0

  const exclusiveEnd = end.add(1, 'day')
  const calendarMonths = (exclusiveEnd.year() - start.year()) * 12 + exclusiveEnd.month() - start.month()
  const anniversary = start.add(calendarMonths, 'month')
  return Math.max(1, calendarMonths + (exclusiveEnd.isAfter(anniversary, 'day') ? 1 : 0))
}

export function calculateMonthlyAmortizedAmount(totalAmount: number, validMonths: number) {
  if (!validMonths)
    return 0

  return Number((Number(totalAmount || 0) / validMonths).toFixed(2))
}

export function resolveFeeStatus(record: Pick<RegulatoryFeeRecord, 'manualStatus' | 'validStartDate' | 'validEndDate'>): RegulatoryFeeStatus {
  if (record.manualStatus === 'disabled')
    return '停用'

  const today = dayjs().startOf('day')
  const start = dayjs(record.validStartDate).startOf('day')
  const end = dayjs(record.validEndDate).startOf('day')
  if (today.isBefore(start))
    return '未开始'
  if (today.isAfter(end))
    return '已截止'
  return '生效中'
}

function buildRegulatoryFeePermissions(record: Pick<RegulatoryFeeRecord, 'manualStatus' | 'validStartDate' | 'validEndDate'>) {
  const status = resolveFeeStatus(record)
  const approvalStatus = (record as RegulatoryFeeRecord).approvalStatus
  const approvalLocked = approvalStatus === '审批中' || approvalStatus === '已确认'
  const lockedReason = status === '已截止'
    ? '已截止规费不允许修改或删除'
    : approvalLocked
      ? '审批中或已确认规费不允许修改或删除'
      : '停用规费需先启用后再修改或删除'
  const canMutate = status !== '已截止' && record.manualStatus !== 'disabled' && !approvalLocked
  const canAudit = !approvalLocked && approvalStatus !== '已确认'

  return {
    view: true,
    edit: canMutate ? true : { allowed: false, reason: lockedReason },
    delete: canMutate ? true : { allowed: false, reason: lockedReason },
    audit: canAudit ? true : { allowed: false, reason: '当前规费不可重复提交审批' },
    revoke: approvalStatus === '审批中' ? true : { allowed: false, reason: '仅审批中规费可撤回' },
    void: { allowed: false, reason: '规费管理当前不走作废流程' },
    confirmImport: { allowed: false, reason: '规费管理不是导入确认记录' },
  }
}

function withRecordPermissions(record: RegulatoryFeeRecord) {
  const normalizedRecord = { ...record, status: resolveFeeStatus(record) }
  return {
    ...normalizedRecord,
    permissions: buildRegulatoryFeePermissions(normalizedRecord),
  }
}

function assertCanMutateRegulatoryFee(record: RegulatoryFeeRecord, action: 'edit' | 'delete') {
  const permission = buildRegulatoryFeePermissions(record)[action]
  if (permission !== true)
    throw new Error(typeof permission === 'boolean' ? '无操作权限' : permission.reason || '无操作权限')
}

function buildRecord(input: Omit<RegulatoryFeeRecord, 'validMonths' | 'monthlyAmortizedAmount' | 'status' | 'permissions'>) {
  const validMonths = calculateValidMonths(input.validStartDate, input.validEndDate)
  const record = {
    ...input,
    totalAmount: Number(input.totalAmount),
    validMonths,
    monthlyAmortizedAmount: calculateMonthlyAmortizedAmount(Number(input.totalAmount), validMonths),
    approvalStatus: input.approvalStatus ?? '草稿',
    status: '未开始' as RegulatoryFeeStatus,
  }
  record.status = resolveFeeStatus(record)
  return record
}

export async function listRegulatoryFees(query: RegulatoryFeeQuery = {}) {
  await hydrateRegulatoryFeeStore()
  const current = Number(query.current || 1)
  const pageSize = Number(query.pageSize || 10)
  const dateRange = resolveQueryDateRange(query)

  const records = feeStore
    .filter(record => !record.deletedAt)
    .map(record => withRecordPermissions(record))
    .filter((record) => {
      if (query.plateNo) {
        const plateKeyword = normalizePlateNo(query.plateNo)
        if (!normalizePlateNo(record.plateNo).includes(plateKeyword))
          return false
      }
      if (query.trailerNo) {
        const trailerKeyword = normalizePlateNo(query.trailerNo)
        if (!normalizePlateNo(record.trailerNo).includes(trailerKeyword))
          return false
      }
      if (query.feeType && record.feeType !== query.feeType)
        return false
      if (query.status && record.status !== query.status)
        return false
      if (dateRange) {
        const start = dayjs(dateRange.startDate)
        const end = dayjs(dateRange.endDate)
        const recordStart = dayjs(record.validStartDate)
        const recordEnd = dayjs(record.validEndDate).add(1, 'day')
        return recordEnd.isAfter(start) && recordStart.isBefore(end)
      }
      return true
    })
    .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())

  const startIndex = (current - 1) * pageSize
  return {
    records: records.slice(startIndex, startIndex + pageSize),
    total: records.length,
  }
}

export async function summarizeRegulatoryFees(query: RegulatoryFeeQuery = {}) {
  const { records, total } = await listRegulatoryFees({ ...query, current: 1, pageSize: 100000 })
  const activeStatisticRecords = records.filter(item => item.status === '生效中')
  const totalAmount = roundAmount(activeStatisticRecords.reduce((sum, item) => sum + calculateAllocatedAmount(item, query), 0))
  const monthlyAmortizedAmount = roundAmount(activeStatisticRecords.reduce((sum, item) => sum + Number(item.monthlyAmortizedAmount || 0), 0))
  const typeAmountMap = new Map<string, { feeType: string, amount: number, count: number }>()
  activeStatisticRecords.forEach((item) => {
    const feeType = item.feeType || item.feeName || '其他规费'
    const current = typeAmountMap.get(feeType) || { feeType, amount: 0, count: 0 }
    current.amount += calculateAllocatedAmount(item, query)
    current.count += 1
    typeAmountMap.set(feeType, current)
  })
  const typeAmounts = Array.from(typeAmountMap.values())
    .map(item => ({ ...item, amount: roundAmount(item.amount) }))
    .sort((a, b) => b.amount - a.amount)
  const approvalTotalAmount = records
    .filter(item => !isExpiredRecord(item) && ['审批中', '已确认'].includes(String(item.approvalStatus || '')))
    .reduce((sum, item) => sum + calculateAllocatedAmount(item, query), 0)
  const usedAmount = records
    .filter(item => !isExpiredRecord(item) && item.approvalStatus === '已确认')
    .reduce((sum, item) => sum + calculateAllocatedAmount(item, query), 0)
  const activeCount = records.filter(item => item.status === '生效中').length
  const pendingCount = records.filter(item => item.status === '未开始').length
  const expiredCount = records.filter(item => item.status === '已截止').length
  const disabledCount = records.filter(item => item.status === '停用').length
  const upcomingExpiredCount = records.filter((item) => {
    const end = dayjs(item.validEndDate)
    return item.status === '生效中' && end.diff(dayjs(), 'day') <= 30 && end.diff(dayjs(), 'day') >= 0
  }).length

  return {
    totalCount: activeStatisticRecords.length,
    totalAmount,
    monthlyAmortizedAmount,
    typeAmounts,
    approvalTotalAmount: roundAmount(approvalTotalAmount),
    usedAmount: roundAmount(usedAmount),
    activeCount,
    pendingCount,
    expiredCount,
    disabledCount,
    upcomingExpiredCount,
  }
}

export async function listRegulatoryFeeOverview(query: RegulatoryFeeOverviewQuery = {}) {
  await hydrateRegulatoryFeeStore()
  const rowsByPlateNo = new Map<string, RegulatoryFeeOverviewRow & { recordCount: number, totalAmount: number, trailerPlateNos: string[] }>()
  const latestMainPlateNoByArea = new Map<string, string>()

  feeStore
    .filter(record => !record.deletedAt)
    .map(record => withRecordPermissions(record))
    .forEach((record) => {
      const plateNo = extractPlateNo(record)
      if (!plateNo)
        return

      const field = resolveOverviewField(record)
      if (!field)
        return

      const area = record.area || '-'
      let rowKey = plateNo
      let displayPlateNo = plateNo
      const trailerNo = normalizePlateNo(record.trailerNo)

      if (trailerNo && !isTrailerPlateNo(plateNo)) {
        latestMainPlateNoByArea.set(area, plateNo)
      }
      else if (isTrailerPlateNo(plateNo)) {
        const mainPlateNo = latestMainPlateNoByArea.get(area)
        if (mainPlateNo) {
          rowKey = mainPlateNo
          displayPlateNo = mainPlateNo
        }
      }
      else {
        latestMainPlateNoByArea.set(area, plateNo)
      }

      const row = rowsByPlateNo.get(rowKey) || {
        id: rowsByPlateNo.size + 1,
        plateNo: displayPlateNo,
        area,
        recordCount: 0,
        totalAmount: 0,
        trailerPlateNos: [],
      }

      if (trailerNo && !row.trailerPlateNos.includes(trailerNo))
        row.trailerPlateNos.push(trailerNo)
      else if (isTrailerPlateNo(plateNo) && rowKey !== plateNo && !row.trailerPlateNos.includes(plateNo))
        row.trailerPlateNos.push(plateNo)

      row.plateNo = displayPlateNo
      if (row.trailerPlateNos.length)
        row.plateNo = [displayPlateNo, ...row.trailerPlateNos].join('\n')
      row.area = area || row.area || '-'
      row.recordCount += isExpiredRecord(record) ? 0 : 1
      row.totalAmount += calculateAllocatedAmount(record, query)
      row[field] = resolveLatestOverviewDate(row[field], record.validEndDate) as never
      rowsByPlateNo.set(rowKey, row)
    })

  let records = Array.from(rowsByPlateNo.values())

  if (query.plateNo)
    records = records.filter(row => row.plateNo.includes(String(query.plateNo).trim()))
  if (query.upcomingOnly)
    records = records.filter(row => overviewDateFields.some(key => isUpcomingOverviewDate(row[key])))

  const totalAmount = roundAmount(records.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0))
  const totalCount = records.reduce((sum, row) => sum + Number(row.recordCount || 0), 0)
  return {
    summary: {
      totalCount,
      totalAmount,
    },
    records: records.map(({ recordCount: _recordCount, totalAmount: _totalAmount, trailerPlateNos: _trailerPlateNos, ...row }, index) => ({
      ...row,
      id: index + 1,
    })),
  }
}

export function resolveQueryDateRange(query: RegulatoryFeeQuery) {
  if (query.startDate && query.endDate) {
    return {
      startDate: String(query.startDate),
      endDate: String(query.endDate),
    }
  }

  if (query.financialYear && query.financialMonth) {
    const year = Number(query.financialYear)
    const month = Number(query.financialMonth)
    const naturalMonthStart = dayjs().year(year).month(month - 1).date(1).startOf('day')
    return {
      startDate: naturalMonthStart.subtract(1, 'month').date(26).format(DATE_FORMAT),
      endDate: naturalMonthStart.date(26).format(DATE_FORMAT),
    }
  }

  if (query.financialYear) {
    const year = Number(query.financialYear)
    return {
      startDate: dayjs().year(year - 1).month(11).date(26).format(DATE_FORMAT),
      endDate: dayjs().year(year).month(11).date(26).format(DATE_FORMAT),
    }
  }
}

export async function getRegulatoryFee(id: number) {
  await hydrateRegulatoryFeeStore()
  const record = feeStore.find(item => item.id === id && !item.deletedAt)
  return record ? withRecordPermissions(record) : undefined
}

export async function isDuplicateFeeName(feeName: string, excludeId?: number) {
  await hydrateRegulatoryFeeStore()
  return feeStore.some(record => !record.deletedAt && record.id !== excludeId && record.feeName === feeName.trim())
}

export async function createRegulatoryFee(payload: RegulatoryFeePayload) {
  await hydrateRegulatoryFeeStore()
  validatePayload(payload)
  const feeName = (payload.feeName || payload.feeType).trim()

  const record = buildRecord({
    id: getNextId(),
    feeName,
    feeType: payload.feeType,
    plateNo: normalizePlateNo(payload.plateNo),
    trailerNo: normalizePlateNo(payload.trailerNo),
    area: payload.area?.trim(),
    totalAmount: Number(payload.totalAmount),
    validStartDate: payload.validStartDate,
    validEndDate: payload.validEndDate,
    manualStatus: 'enabled',
    remark: payload.remark,
    attachmentName: payload.attachmentName,
    attachmentUrl: payload.attachmentUrl,
    createdAt: now(),
    updatedAt: now(),
    createdBy: 1,
  })

  feeStore.unshift(record)
  await persistStore()
  await officeVehicleStore.ensureVehicleFromRegulatoryFee(record.plateNo || '', record.area)
  return withRecordPermissions(record)
}

export async function importRegulatoryFees(payloads: RegulatoryFeePayload[]) {
  await hydrateRegulatoryFeeStore()
  if (!Array.isArray(payloads) || !payloads.length)
    throw new Error('没有可导入的规费记录')
  if (payloads.length > 1000)
    throw new Error('单次最多导入 1000 条规费记录')

  payloads.forEach(validatePayload)
  const existingKeys = new Set(feeStore.filter(record => !record.deletedAt).map(buildImportDuplicateKey))
  const batchKeys = new Set<string>()
  const duplicateDetails: string[] = []
  payloads.forEach((payload, index) => {
    const key = buildImportDuplicateKey(payload)
    if (existingKeys.has(key))
      duplicateDetails.push(`第 ${index + 1} 条已存在：${describeImportRecord(payload)}`)
    else if (batchKeys.has(key))
      duplicateDetails.push(`第 ${index + 1} 条在本次文件中重复：${describeImportRecord(payload)}`)
    batchKeys.add(key)
  })
  if (duplicateDetails.length) {
    const visibleDetails = duplicateDetails.slice(0, 10).join('；')
    const remaining = duplicateDetails.length > 10 ? `；其余 ${duplicateDetails.length - 10} 条未展开` : ''
    throw new Error(`发现 ${duplicateDetails.length} 条重复规费，禁止导入：${visibleDetails}${remaining}`)
  }
  const snapshot = [...feeStore]
  const nextIdSnapshot = globalStore.__regulatoryFeeNextId
  const records = payloads.map(payload => buildRecord({
    id: getNextId(),
    feeName: (payload.feeName || payload.feeType).trim(),
    feeType: payload.feeType,
    plateNo: normalizePlateNo(payload.plateNo),
    trailerNo: normalizePlateNo(payload.trailerNo),
    area: payload.area?.trim(),
    totalAmount: Number(payload.totalAmount),
    validStartDate: payload.validStartDate,
    validEndDate: payload.validEndDate,
    manualStatus: 'enabled',
    remark: payload.remark,
    attachmentName: payload.attachmentName,
    attachmentUrl: payload.attachmentUrl,
    createdAt: now(),
    updatedAt: now(),
    createdBy: 1,
  }))

  feeStore.unshift(...records)
  try {
    await persistStore()
    await officeVehicleStore.ensureVehiclesFromRegulatoryFees(records.map(record => ({ plateNo: record.plateNo || '', area: record.area })))
  }
  catch (error) {
    feeStore.splice(0, feeStore.length, ...snapshot)
    globalStore.__regulatoryFeeNextId = nextIdSnapshot
    throw error
  }
  return records.map(withRecordPermissions)
}

export async function updateRegulatoryFee(id: number, payload: RegulatoryFeePayload) {
  await hydrateRegulatoryFeeStore()
  validatePayload(payload)
  const feeName = (payload.feeName || payload.feeType).trim()

  const index = feeStore.findIndex(item => item.id === id && !item.deletedAt)
  if (index < 0)
    throw new Error('规费不存在')

  assertCanMutateRegulatoryFee(feeStore[index], 'edit')

  feeStore[index] = buildRecord({
    ...feeStore[index],
    feeName,
    feeType: payload.feeType,
    plateNo: normalizePlateNo(payload.plateNo),
    trailerNo: normalizePlateNo(payload.trailerNo),
    area: payload.area?.trim(),
    totalAmount: Number(payload.totalAmount),
    validStartDate: payload.validStartDate,
    validEndDate: payload.validEndDate,
    remark: payload.remark,
    attachmentName: payload.attachmentName,
    attachmentUrl: payload.attachmentUrl,
    updatedAt: now(),
  })

  await persistStore()
  await officeVehicleStore.ensureVehicleFromRegulatoryFee(feeStore[index].plateNo || '', feeStore[index].area)
  return withRecordPermissions(feeStore[index])
}

export async function deleteRegulatoryFee(id: number) {
  await hydrateRegulatoryFeeStore()
  const record = feeStore.find(item => item.id === id && !item.deletedAt)
  if (!record)
    throw new Error('规费不存在')

  assertCanMutateRegulatoryFee(record, 'delete')

  record.deletedAt = now()
  record.updatedAt = now()
  await persistStore()
  return withRecordPermissions(record)
}

export async function changeRegulatoryFeeManualStatus(id: number, manualStatus: RegulatoryFeeManualStatus) {
  await hydrateRegulatoryFeeStore()
  const record = feeStore.find(item => item.id === id && !item.deletedAt)
  if (!record)
    throw new Error('规费不存在')
  assertStatusValue(manualStatus, ['enabled', 'disabled'], '规费手工状态')
  assertStatusTransition(record.manualStatus, manualStatus, manualEnableTransitions, '规费手工状态')

  record.manualStatus = manualStatus
  record.updatedAt = now()
  record.status = resolveFeeStatus(record)
  await persistStore()
  return withRecordPermissions(record)
}

export async function submitRegulatoryFeeApproval(id: number, context: { userId?: string | number, userName?: string, deptId?: string | number, deptName?: string } = {}) {
  await hydrateRegulatoryFeeStore()
  const record = feeStore.find(item => item.id === id && !item.deletedAt)
  if (!record)
    throw new Error('规费不存在')
  if (record.approvalStatus === '审批中' || record.approvalStatus === '已确认')
    throw new Error('该规费已提交审批或已确认')

  const detail = await approvalStore.submit({
    businessType: 'transport_fee',
    businessId: String(record.id),
    businessNo: String(record.id),
    title: `规费审批-${record.feeName}`,
    applicantId: context.userId || record.createdBy || 1,
    applicantName: context.userName || '超级管理员',
    deptId: context.deptId,
    deptName: context.deptName,
    amount: record.totalAmount,
    formData: {
      ...record,
      moduleName: '规费管理',
      modulePath: '/transport/fees',
      plateNo: extractPlateNo(record),
      occurredDate: record.validStartDate,
      feeType: '规费',
      amount: record.totalAmount,
      businessNo: String(record.id),
    },
  })
  record.approvalStatus = '审批中'
  record.approvalInstanceId = detail.instance.id
  record.updatedAt = now()
  await persistStore()
  return withRecordPermissions(record)
}

function validatePayload(payload: RegulatoryFeePayload) {
  if (!payload.feeType)
    throw new Error('规费类型不能为空')
  if (!payload.plateNo?.trim())
    throw new Error('车号不能为空')
  const totalAmount = Number(payload.totalAmount)
  if (!Number.isFinite(totalAmount) || totalAmount < 0)
    throw new Error('单项总费用必须是有效的非负数')
  if (!payload.validStartDate)
    throw new Error('有效期开始日期不能为空')
  if (!payload.validEndDate)
    throw new Error('有效期截止日期不能为空')
  if (!dayjs(payload.validStartDate).isValid() || !dayjs(payload.validEndDate).isValid())
    throw new Error('有效期日期格式不合法')
  if (dayjs(payload.validEndDate).isBefore(dayjs(payload.validStartDate), 'day'))
    throw new Error('截止日期不能早于开始日期')
  if (calculateValidMonths(payload.validStartDate, payload.validEndDate) <= 0)
    throw new Error('有效时长不能为 0')
}
