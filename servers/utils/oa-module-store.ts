import type mysql from 'mysql2/promise'
import type { OaStructuredRecordConfig } from '../services/approval/oa-structured-record'
import type { ApprovalInstance } from './approval-store'
import type { BankPaymentSubmission } from './payment-provider'
import { APPROVAL_BUSINESS_MAP, approvalFinancePolicy, approvalOaModuleKey } from '../../shared/approval-business-catalog'
import { mergeOaStructuredRecord, oaStructuredRecordConfigs, toOaExtensionRecord } from '../services/approval/oa-structured-record'
import { registerApprovalBusinessHandler } from './approval-callback-dispatcher'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'

export type OaModuleKey = 'dashboard' | 'receivable' | 'cash' | 'salary' | 'org' | 'vehicle'

export interface OaModuleState {
  modules: Record<OaModuleKey, Array<Record<string, any>>>
  cashBalanceRecords: Array<Record<string, any>>
  revision?: number
}

export type OaStatePartition = OaModuleKey | 'cashBalance'

export interface RegisterReceiptInput {
  cashBalanceId?: string
  accountName: string
  amount: number
  receiptDate: string
  payerName: string
  bankSerialNo: string
  accountType?: string
  receiptType?: string
  handler?: string
  remark?: string
  sourceApprovalId?: string
  sourceBusinessId?: string
}

export interface ReceiptAllocationInput {
  receivableId: string
  amount: number
  remark?: string
}

export interface AllocateReceiptInput {
  allocations: ReceiptAllocationInput[]
  cashBalanceId: string
  allocationBatchId: string
  handler?: string
}

export interface PaymentAllocationInput {
  payableId: string
  amount: number
  remark?: string
}

export interface CreatePaymentInstructionInput {
  paymentRequestNo: string
  cashBalanceId?: string
  companyName?: string
  accountNo?: string
  accountName: string
  paymentDate: string
  payeeName: string
  allocations: PaymentAllocationInput[]
  accountType?: string
  paymentMethod?: string
  handler?: string
  remark?: string
  sourceApprovalId?: string
}

export interface ConfirmPaymentInput {
  bankSerialNo: string
  paidAt?: string
  handler?: string
}

export interface BankPaymentCallbackInput {
  eventId: string
  paymentRequestNo: string
  status: 'SUCCESS' | 'FAILED'
  bankSerialNo?: string
  paidAt?: string
  reason?: string
}

const unsettledPaymentStatuses = ['PENDING', 'PROCESSING']

const moduleKeys: OaModuleKey[] = ['dashboard', 'receivable', 'cash', 'salary', 'org', 'vehicle']
const lockedSalaryStatuses = new Set(['审批通过', '已锁定', '已发放', '已作废', '已归档'])

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function cloneState(state: OaModuleState): OaModuleState {
  return JSON.parse(JSON.stringify(state))
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(item => stableValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]))
  }
  return value
}

function assertSalaryPartitionUpdate(previousRows: Array<Record<string, any>>, nextRows: Array<Record<string, any>>) {
  const nextById = new Map(nextRows.map(row => [String(row.id), row]))
  for (const previous of previousRows) {
    if (!lockedSalaryStatuses.has(String(previous.status)))
      continue
    const id = String(previous.id)
    const next = nextById.get(id)
    if (!next)
      throw new Error(`工资记录 ${previous.employeeName || id} 已锁定，不能删除`)
    if (!lockedSalaryStatuses.has(String(next.status)))
      throw new Error(`工资记录 ${previous.employeeName || id} 已锁定，不能回退状态`)
    if (JSON.stringify(stableValue(previous)) !== JSON.stringify(stableValue(next)))
      throw new Error(`工资记录 ${previous.employeeName || id} 已锁定，不能修改`)
  }
}

function normalizeState(input: Partial<OaModuleState> = {}): OaModuleState {
  const modules = input.modules || {}
  return {
    modules: {
      dashboard: Array.isArray(modules.dashboard) ? modules.dashboard : [],
      receivable: Array.isArray(modules.receivable) ? modules.receivable : [],
      cash: Array.isArray(modules.cash) ? modules.cash : [],
      salary: Array.isArray(modules.salary) ? modules.salary : [],
      org: Array.isArray(modules.org) ? modules.org : [],
      vehicle: Array.isArray(modules.vehicle) ? modules.vehicle : [],
    },
    cashBalanceRecords: Array.isArray(input.cashBalanceRecords) ? input.cashBalanceRecords : [],
    revision: Number(input.revision || 0),
  }
}

function createSeedState(): OaModuleState {
  const createdAt = now()
  return normalizeState({
    modules: {
      dashboard: [
        { id: 'oa-dash-1', code: 'OA20260706001', approvalType: '费用报销', applicant: '赵会计', amount: 5800, status: '待审批', date: '2026-07-06', financialYear: 2026, financialMonth: 7, remark: '车辆保险费用审批', createdBy: 1, approverId: 1 },
        { id: 'oa-dash-2', code: 'OA20260705009', approvalType: '付款申请', applicant: '王经理', amount: 23600, status: '审批中', date: '2026-07-05', financialYear: 2026, financialMonth: 7, remark: '供应商结算付款', createdBy: 2, approverId: 1 },
      ],
      receivable: [
        { id: 'ar-1', code: 'AR202607001', counterparty: '上海客户', billType: '应收', amount: 86000, paidAmount: 36000, unpaidAmount: 50000, dueDate: '2026-07-18', status: '部分收款', relatedBill: 'YS20260705001', remark: '运输收入', date: '2026-07-05', financialYear: 2026, financialMonth: 7, createdBy: 1, approverId: 1 },
        { id: 'ap-1', code: 'AP202607002', counterparty: '昆仑能源', billType: '应付', amount: 42000, paidAmount: 0, unpaidAmount: 42000, dueDate: '2026-07-10', status: '未付', relatedBill: 'CG20260701001', remark: '燃气采购', date: '2026-07-02', financialYear: 2026, financialMonth: 7, createdBy: 2, approverId: 1 },
      ],
      cash: [
        { id: 'cash-1', code: 'CA202607001', accountName: '工行基本户', accountType: '银行账户', openingBalance: 480000, incomeAmount: 86000, expenseAmount: 42000, currentBalance: 524000, date: '2026-07-05', flowType: '收支流水', relatedBill: 'AR202607001', handler: '赵会计', status: '正常', remark: '客户收款入账', financialYear: 2026, financialMonth: 7, createdBy: 1, approverId: 1 },
        { id: 'cash-2', code: 'CA202607002', accountName: '备用金', accountType: '现金账户', openingBalance: 30000, incomeAmount: 0, expenseAmount: 5800, currentBalance: 24200, date: '2026-07-06', flowType: '支出登记', relatedBill: 'OA20260706001', handler: '李行政', status: '待审批', remark: '车辆保险垫付', financialYear: 2026, financialMonth: 7, createdBy: 2, approverId: 1 },
      ],
      salary: [
        { id: 'salary-1', code: 'SA202607001', companyName: '青海诚捷运输有限公司', sequenceNo: 1, employeeName: '王师傅', department: '运输部', position: '驾驶员', financialYear: 2026, financialMonth: 7, attendanceDays: 31, basicSalary: 7800, performanceSalary: 2200, grossSalary: 10000, attendanceSalary: 0, senioritySalary: 0, overtimeAllowance: 300, travelAllowance: 300, retroactiveSalary: 0, totalAmount: 10600, socialSecurityBase: 5290, companyPension: 846.4, companyMedical: 365.01, companyInjury: 30.41, companyUnemployment: 26.45, companySocialSecurityTotal: 1268.26, personalPension: 423.2, personalMedical: 105.8, personalInjury: 0, personalUnemployment: 26.45, personalSocialSecurityTotal: 555.45, tax: 120, netSalary: 9924.55, cashPayment: '', remark: '', payStatus: '未发放', status: '待审批', date: '2026-07-05', createdBy: 2, approverId: 1 },
      ],
      org: [
        { id: 'org-1', code: 'ORG001', orgType: '公司', name: '企业管理系统', parentDepartment: '-', position: '-', leader: '总经理', approver: '总经理', role: '管理员', phone: '-', status: '正常', date: '2026-07-01', financialYear: 2026, financialMonth: 7, createdBy: 1, approverId: 1 },
        { id: 'org-2', code: 'DEP001', orgType: '部门', name: '财务部', parentDepartment: '企业管理系统', position: '-', leader: '赵会计', approver: '赵会计', role: '财务审批', phone: '13800000001', status: '正常', date: '2026-07-02', financialYear: 2026, financialMonth: 7, createdBy: 1, approverId: 1 },
        { id: 'org-3', code: 'EMP001', orgType: '员工', name: '赵会计', parentDepartment: '财务部', position: '财务会计', leader: '总经理', approver: '赵会计', financeApprover: '赵会计', adminApprover: '赵会计', vehicleApprover: '赵会计', salaryApprover: '赵会计', role: '财务审批', companyName: '青海诚域能源有限公司', phone: '13800000001', email: 'zhao@example.com', hireDate: '2025-01-10', basicSalary: 9000, performanceSalary: 1800, senioritySalary: 0, overtimeAllowance: 0, travelAllowance: 0, retroactiveSalary: 0, socialSecurityBase: 5186, tax: 260, status: '在职', date: '2026-07-06', financialYear: 2026, financialMonth: 7, createdBy: 1, approverId: 1 },
      ],
      vehicle: [
        { id: 'vehicle-1', code: 'OV20260706001', applicant: '李行政', employeeId: 'EMP003', department: '行政部', projectName: '证照年审项目', date: '2026-07-06', startTime: '09:00', endTime: '12:00', timeRange: '09:00-12:00', departure: '公司', destination: '政务中心', reason: '证照办理', usageSummary: '公司-政务中心 / 证照办理 / 36km', passengers: 2, vehicleType: '商务车', vehicleName: '别克GL8', plateNo: '沪A·8899', vehicleInfo: '别克GL8 / 沪A·8899', driver: '周师傅', expenseType: '停车费', fuelFee: 0, tollFee: 0, parkingFee: 20, maintenanceFee: 0, insuranceFee: 0, inspectionFee: 0, otherFee: 0, totalFee: 20, attachmentName: '停车票_OV20260706001.jpg', attachmentStatus: '已上传', approvalNo: 'OA20260706001', status: '审批中', notifyStatus: '已通知审批人', reminderText: '-', mileage: 36, remark: '票据已关联附件', financialYear: 2026, financialMonth: 7, createdBy: 3, approverId: 1 },
      ],
    },
    cashBalanceRecords: [
      { id: 'cb-1', balance_date: '2026-07-05', company_name: '上海诚捷物流有限公司', bank_name: '工商银行', account_name: '工行基本户', account_no_tail: '8801', balance_amount: 168230.46, remark: '基本户余额', created_by: 1, created_at: createdAt, updated_by: 1, updated_at: createdAt },
      { id: 'cb-2', balance_date: '2026-07-05', company_name: '上海诚捷物流有限公司', bank_name: '建设银行', account_name: '建行一般户', account_no_tail: '1266', balance_amount: 84320.2, remark: '一般户余额', created_by: 1, created_at: createdAt, updated_by: 1, updated_at: createdAt },
    ],
  })
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null)
    return fallback
  if (typeof value === 'string')
    return JSON.parse(value) as T
  return value as T
}

function toNumber(value: unknown) {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(number) ? number : 0
}

function dateOnly(value: unknown) {
  const text = String(value || '').trim()
  return text ? text.slice(0, 10) : null
}

function dateTime(value: unknown) {
  const text = String(value || '').trim()
  if (!text)
    return null
  return text.length <= 10 ? `${text} 00:00:00` : text.replace('T', ' ').slice(0, 19)
}

function rowId(row: Record<string, any>, fallback: string) {
  return String(row.id || row.code || fallback)
}

function rowCode(row: Record<string, any>, fallback: string) {
  return String(row.code || row.id || fallback)
}

function receiptDuplicateKey(input: Pick<RegisterReceiptInput, 'accountName' | 'bankSerialNo'>) {
  return `${String(input.accountName).trim().toLowerCase()}::${String(input.bankSerialNo).trim().toLowerCase()}`
}

function receiptStatus(recognizedAmount: number, amount: number) {
  if (recognizedAmount <= 0)
    return '未认领'
  return recognizedAmount >= amount ? '已核销' : '部分认领'
}

function cashBalanceDisplayName(account: Record<string, any>) {
  return String(account.bank_name || account.account_name || '').trim()
}

function postReceiptToCashBalance(
  state: OaModuleState,
  receipt: Record<string, any>,
  cashBalanceId: string,
  handler = '',
) {
  const account = state.cashBalanceRecords.find(row => String(row.id) === String(cashBalanceId))
  if (!account)
    throw new Error('核销对应的收款账户不存在')
  if (receipt.cashBalanceId && String(receipt.cashBalanceId) !== String(account.id))
    throw new Error('该来款已经绑定其他收款账户')

  const existingMovement = (Array.isArray(account.balanceMovements) ? account.balanceMovements : [])
    .find((item: any) => item.type === 'RECEIPT' && String(item.receiptId) === String(receipt.id))
  if (receipt.balancePostedAt || existingMovement) {
    receipt.cashBalanceId = account.id
    return account
  }

  const amount = Number(Number(receipt.incomeAmount || 0).toFixed(2))
  const balanceBefore = Number(account.balance_amount || 0)
  const balanceAfter = Number((balanceBefore + amount).toFixed(2))
  const postedAt = now()
  account.balanceMovements = Array.isArray(account.balanceMovements) ? account.balanceMovements : []
  account.balanceMovements.unshift({
    id: `receipt-posting-${receipt.id}`,
    type: 'RECEIPT',
    direction: 'IN',
    amount,
    balanceBefore,
    balanceAfter,
    receiptId: receipt.id,
    receiptCode: receipt.code,
    bankSerialNo: receipt.bankSerialNo,
    payerName: receipt.payerName || receipt.counterpartyName || '',
    receivableCodes: [],
    allocatedAmount: 0,
    unrecognizedAmount: amount,
    occurredAt: receipt.date,
    postedAt,
    operator: handler || receipt.handler || '',
  })
  account.balance_amount = balanceAfter
  account.balance_date = String(account.balance_date || '') > String(receipt.date || '')
    ? account.balance_date
    : receipt.date
  account.updated_at = postedAt
  account.updated_by = handler || receipt.handler || '来款入账'

  receipt.cashBalanceId = account.id
  receipt.companyName = account.company_name || ''
  receipt.bankName = account.bank_name || ''
  receipt.cashBalanceAccountName = cashBalanceDisplayName(account)
  receipt.accountNo = account.account_no_tail || ''
  receipt.accountName = cashBalanceDisplayName(account)
  receipt.openingBalance = balanceBefore
  receipt.currentBalance = balanceAfter
  receipt.balancePostedAmount = amount
  receipt.balancePostedAt = postedAt
  receipt.balancePostingId = `receipt-posting-${receipt.id}`
  return account
}

function validateReceiptInput(input: RegisterReceiptInput) {
  if (!String(input.accountName || '').trim())
    throw new Error('收款账户不能为空')
  if (!String(input.payerName || '').trim())
    throw new Error('付款方不能为空')
  if (!String(input.bankSerialNo || '').trim())
    throw new Error('银行流水号不能为空')
  if (!dateOnly(input.receiptDate) || Number.isNaN(new Date(input.receiptDate).getTime()))
    throw new Error('到账日期不能为空')
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0)
    throw new Error('来款金额必须大于0')
}

function addReceiptToState(state: OaModuleState, input: RegisterReceiptInput) {
  validateReceiptInput(input)
  const duplicateKey = receiptDuplicateKey(input)
  const existing = state.modules.cash.find(row => row.receiptDuplicateKey === duplicateKey || (input.sourceApprovalId && row.sourceApprovalId === input.sourceApprovalId))
  if (existing) {
    if (input.sourceApprovalId && existing.sourceApprovalId === input.sourceApprovalId)
      return existing
    throw new Error('该收款账户下的银行流水号已存在')
  }

  const amount = Number(Number(input.amount).toFixed(2))
  const receiptDate = dateOnly(input.receiptDate)!
  const previousBalance = state.modules.cash
    .filter(row => row.accountName === input.accountName && row.date <= receiptDate)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    ?.currentBalance || 0
  const idSeed = input.sourceApprovalId || `${Date.now()}-${state.modules.cash.length + 1}`
  const row = {
    id: `receipt-${idSeed}`,
    code: `RC-${String(input.bankSerialNo).trim()}`,
    accountName: String(input.accountName).trim(),
    accountType: input.accountType || '银行账户',
    openingBalance: Number(previousBalance),
    incomeAmount: amount,
    expenseAmount: 0,
    currentBalance: Number((Number(previousBalance) + amount).toFixed(2)),
    date: receiptDate,
    flowType: '来款登记',
    payerName: String(input.payerName).trim(),
    counterpartyName: String(input.payerName).trim(),
    bankSerialNo: String(input.bankSerialNo).trim(),
    receiptDuplicateKey: duplicateKey,
    receiptType: input.receiptType || '待确认',
    recognizedAmount: 0,
    unrecognizedAmount: amount,
    allocations: [],
    handler: input.handler || '',
    status: '未认领',
    remark: input.remark || '',
    sourceApprovalId: input.sourceApprovalId,
    sourceBusinessId: input.sourceBusinessId,
    financialYear: new Date(receiptDate).getFullYear(),
    financialMonth: new Date(receiptDate).getMonth() + 1,
  }
  state.modules.cash.unshift(row)
  return row
}

function paymentFingerprint(input: CreatePaymentInstructionInput) {
  const allocations = [...input.allocations]
    .map(item => ({ payableId: String(item.payableId), amount: Number(Number(item.amount).toFixed(2)) }))
    .sort((a, b) => a.payableId.localeCompare(b.payableId))
  return JSON.stringify({
    paymentRequestNo: String(input.paymentRequestNo).trim(),
    cashBalanceId: String(input.cashBalanceId || '').trim(),
    companyName: String(input.companyName || '').trim(),
    accountNo: String(input.accountNo || '').trim(),
    accountName: String(input.accountName).trim(),
    paymentDate: dateOnly(input.paymentDate),
    payeeName: String(input.payeeName).trim(),
    allocations,
  })
}

function validatePaymentInstruction(input: CreatePaymentInstructionInput) {
  if (!String(input.paymentRequestNo || '').trim())
    throw new Error('付款请求号不能为空')
  if (!String(input.accountName || '').trim())
    throw new Error('付款账户不能为空')
  if (!String(input.payeeName || '').trim())
    throw new Error('收款方不能为空')
  if (!dateOnly(input.paymentDate) || Number.isNaN(new Date(input.paymentDate).getTime()))
    throw new Error('付款日期不合法')
  if (!Array.isArray(input.allocations) || input.allocations.length === 0)
    throw new Error('至少选择一张应付单')
  if (input.allocations.some(item => !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0))
    throw new Error('付款金额必须大于0')
  if (new Set(input.allocations.map(item => String(item.payableId))).size !== input.allocations.length)
    throw new Error('同一应付单不能重复选择')
}

async function ensureColumn(db: mysql.Pool, table: string, column: string, definition: string) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  catch (error: any) {
    if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(error?.code))
      throw error
  }
}

async function ensureSchema(db: mysql.Pool) {
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS oa_module_state (
      id VARCHAR(64) PRIMARY KEY,
      state_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS oa_module_revision (
      id VARCHAR(64) PRIMARY KEY,
      revision BIGINT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.execute('INSERT IGNORE INTO oa_module_revision (id, revision, updated_at) VALUES (?, 0, NOW())', ['default'])
  await db.query(`
    CREATE TABLE IF NOT EXISTS oa_module_revision_log (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      revision BIGINT NOT NULL,
      partition_key VARCHAR(64) NOT NULL,
      rows_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_oa_revision_partition (revision, partition_key),
      KEY idx_oa_revision_log_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await ensureColumn(db, 'finance_receivable_payable', 'record_json', 'JSON NULL')
  await ensureColumn(db, 'finance_cash_flow', 'record_json', 'JSON NULL')
  await ensureColumn(db, 'finance_cash_balance', 'balance_json', 'JSON NULL')
  await ensureColumn(db, 'hr_salary_record', 'record_json', 'JSON NULL')
}

async function readStructuredRows(db: mysql.Pool, table: string, config: OaStructuredRecordConfig) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY updated_at DESC`)
  return rows.map((row: any) => mergeOaStructuredRecord(parseJson(row[config.jsonColumn], {}), row, config))
}

async function loadStructuredState(db: mysql.Pool): Promise<{ hasData: boolean, state: OaModuleState }> {
  const state = normalizeState({
    modules: {
      dashboard: await readStructuredRows(db, 'oa_dashboard_record', oaStructuredRecordConfigs.dashboard),
      receivable: await readStructuredRows(db, 'finance_receivable_payable', oaStructuredRecordConfigs.receivable),
      cash: await readStructuredRows(db, 'finance_cash_flow', oaStructuredRecordConfigs.cash),
      salary: await readStructuredRows(db, 'hr_salary_record', oaStructuredRecordConfigs.salary),
      org: await readStructuredRows(db, 'oa_org_record', oaStructuredRecordConfigs.org),
      vehicle: await readStructuredRows(db, 'oa_vehicle_record', oaStructuredRecordConfigs.vehicle),
    },
    cashBalanceRecords: await readStructuredRows(db, 'finance_cash_balance', oaStructuredRecordConfigs.cashBalance),
  })
  return {
    hasData: moduleKeys.some(key => state.modules[key].length > 0) || state.cashBalanceRecords.length > 0,
    state,
  }
}

async function loadLegacyState(db: mysql.Pool) {
  const [rows] = await db.query<Array<mysql.RowDataPacket & { state_json: string | OaModuleState }>>('SELECT state_json FROM oa_module_state WHERE id = ? LIMIT 1', ['default'])
  const value = rows[0]?.state_json
  return value ? normalizeState(parseJson(value, createSeedState())) : undefined
}

async function replaceSimpleRows(db: mysql.Pool | mysql.PoolConnection, table: string, rows: Array<Record<string, any>>, insert: (row: Record<string, any>, index: number) => Promise<void>) {
  await db.execute(`UPDATE ${table} SET deleted_at = NOW() WHERE deleted_at IS NULL`)
  for (const [index, row] of rows.entries())
    await insert(row, index)
}

async function persistStructuredState(db: mysql.Pool | mysql.PoolConnection, payload: OaModuleState, selectedTables?: ReadonlySet<string>) {
  const state = normalizeState(payload)

  const shouldPersist = (table: string) => !selectedTables || selectedTables.has(table)

  if (shouldPersist('oa_dashboard_record')) {
    await replaceSimpleRows(db, 'oa_dashboard_record', state.modules.dashboard, async (row, index) => {
      await db.execute(`
      INSERT INTO oa_dashboard_record (id, record_json, code, amount, status, record_date, financial_year, financial_month, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), code = VALUES(code), amount = VALUES(amount), status = VALUES(status), record_date = VALUES(record_date), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), updated_at = NOW(), deleted_at = NULL
    `, [rowId(row, `dashboard-${index + 1}`), JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.dashboard)), row.code || null, toNumber(row.amount), row.status || null, dateOnly(row.date), row.financialYear || null, row.financialMonth || null])
    })
  }

  if (shouldPersist('finance_receivable_payable')) {
    await replaceSimpleRows(db, 'finance_receivable_payable', state.modules.receivable, async (row, index) => {
      await db.execute(`
      INSERT INTO finance_receivable_payable (id, record_json, code, counterparty, bill_type, amount, paid_amount, unpaid_amount, due_date, bill_date, related_bill, status, approval_status, approval_instance_id, financial_year, financial_month, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), counterparty = VALUES(counterparty), bill_type = VALUES(bill_type), amount = VALUES(amount), paid_amount = VALUES(paid_amount), unpaid_amount = VALUES(unpaid_amount), due_date = VALUES(due_date), bill_date = VALUES(bill_date), related_bill = VALUES(related_bill), status = VALUES(status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), remark = VALUES(remark), updated_at = NOW(), deleted_at = NULL
    `, [rowId(row, `receivable-${index + 1}`), JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.receivable)), rowCode(row, `RP${index + 1}`), row.counterparty || '', row.billType || '', toNumber(row.amount), toNumber(row.paidAmount), toNumber(row.unpaidAmount), dateOnly(row.dueDate), dateOnly(row.date), row.relatedBill || null, row.status || '', row.approvalStatus || null, row.approvalInstanceId || null, row.financialYear || null, row.financialMonth || null, row.remark || null, row.createdBy == null ? null : String(row.createdBy)])
    })
  }

  if (shouldPersist('finance_cash_flow')) {
    await replaceSimpleRows(db, 'finance_cash_flow', state.modules.cash, async (row, index) => {
      await db.execute(`
      INSERT INTO finance_cash_flow (id, record_json, code, account_name, account_type, opening_balance, income_amount, expense_amount, current_balance, flow_date, flow_type, related_bill, handler, status, approval_status, approval_instance_id, financial_year, financial_month, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), account_name = VALUES(account_name), account_type = VALUES(account_type), opening_balance = VALUES(opening_balance), income_amount = VALUES(income_amount), expense_amount = VALUES(expense_amount), current_balance = VALUES(current_balance), flow_date = VALUES(flow_date), flow_type = VALUES(flow_type), related_bill = VALUES(related_bill), handler = VALUES(handler), status = VALUES(status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), remark = VALUES(remark), updated_at = NOW(), deleted_at = NULL
    `, [rowId(row, `cash-${index + 1}`), JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.cash)), rowCode(row, `CA${index + 1}`), row.accountName || '', row.accountType || '', toNumber(row.openingBalance), toNumber(row.incomeAmount), toNumber(row.expenseAmount), toNumber(row.currentBalance), dateOnly(row.date) || '1970-01-01', row.flowType || '', row.relatedBill || null, row.handler || null, row.status || '', row.approvalStatus || null, row.approvalInstanceId || null, row.financialYear || null, row.financialMonth || null, row.remark || null, row.createdBy == null ? null : String(row.createdBy)])
    })
  }

  if (shouldPersist('hr_salary_record')) {
    await replaceSimpleRows(db, 'hr_salary_record', state.modules.salary, async (row, index) => {
      await db.execute(`
      INSERT INTO hr_salary_record (id, record_json, code, employee_id, employee_name, company_name, dept_name, post_name, financial_year, financial_month, attendance_days, basic_salary, performance_salary, gross_salary, attendance_salary, seniority_salary, overtime_allowance, travel_allowance, retroactive_salary, total_amount, social_security_base, company_pension, company_medical, company_injury, company_unemployment, company_social_security_total, personal_pension, personal_medical, personal_injury, personal_unemployment, personal_social_security_total, tax, net_salary, cash_payment, pay_status, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), employee_name = VALUES(employee_name), company_name = VALUES(company_name), dept_name = VALUES(dept_name), post_name = VALUES(post_name), attendance_days = VALUES(attendance_days), basic_salary = VALUES(basic_salary), performance_salary = VALUES(performance_salary), gross_salary = VALUES(gross_salary), total_amount = VALUES(total_amount), social_security_base = VALUES(social_security_base), tax = VALUES(tax), net_salary = VALUES(net_salary), pay_status = VALUES(pay_status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), remark = VALUES(remark), updated_at = NOW(), deleted_at = NULL
    `, [
        rowId(row, `salary-${index + 1}`),
        JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.salary)),
        rowCode(row, `SAL${index + 1}`),
        row.employeeId || row.employeeCode || row.employeeName || `employee-${index + 1}`,
        row.employeeName || '',
        row.companyName || '',
        row.department || '',
        row.position || '',
        row.financialYear || new Date().getFullYear(),
        row.financialMonth || new Date().getMonth() + 1,
        toNumber(row.attendanceDays),
        toNumber(row.basicSalary),
        toNumber(row.performanceSalary),
        toNumber(row.grossSalary),
        toNumber(row.attendanceSalary),
        toNumber(row.senioritySalary),
        toNumber(row.overtimeAllowance),
        toNumber(row.travelAllowance),
        toNumber(row.retroactiveSalary),
        toNumber(row.totalAmount),
        toNumber(row.socialSecurityBase),
        toNumber(row.companyPension),
        toNumber(row.companyMedical),
        toNumber(row.companyInjury),
        toNumber(row.companyUnemployment),
        toNumber(row.companySocialSecurityTotal),
        toNumber(row.personalPension),
        toNumber(row.personalMedical),
        toNumber(row.personalInjury),
        toNumber(row.personalUnemployment),
        toNumber(row.personalSocialSecurityTotal),
        toNumber(row.tax),
        toNumber(row.netSalary),
        toNumber(row.cashPayment),
        row.payStatus || '未发放',
        row.status || row.approvalStatus || '草稿',
        row.approvalInstanceId || null,
        row.remark || null,
      ])
    })
  }

  if (shouldPersist('oa_org_record')) {
    await replaceSimpleRows(db, 'oa_org_record', state.modules.org, async (row, index) => {
      await db.execute(`
      INSERT INTO oa_org_record (id, record_json, code, org_type, name, parent_department, status, record_date, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), code = VALUES(code), org_type = VALUES(org_type), name = VALUES(name), parent_department = VALUES(parent_department), status = VALUES(status), record_date = VALUES(record_date), updated_at = NOW(), deleted_at = NULL
    `, [rowId(row, `org-${index + 1}`), JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.org)), row.code || null, row.orgType || null, row.name || null, row.parentDepartment || null, row.status || null, dateOnly(row.date)])
    })
  }

  if (shouldPersist('oa_vehicle_record')) {
    await replaceSimpleRows(db, 'oa_vehicle_record', state.modules.vehicle, async (row, index) => {
      await db.execute(`
      INSERT INTO oa_vehicle_record (id, record_json, code, plate_no, applicant, department, total_fee, status, record_date, financial_year, financial_month, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), code = VALUES(code), plate_no = VALUES(plate_no), applicant = VALUES(applicant), department = VALUES(department), total_fee = VALUES(total_fee), status = VALUES(status), record_date = VALUES(record_date), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), updated_at = NOW(), deleted_at = NULL
    `, [rowId(row, `vehicle-${index + 1}`), JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.vehicle)), row.code || null, row.plateNo || null, row.applicant || null, row.department || null, toNumber(row.totalFee), row.status || null, dateOnly(row.date), row.financialYear || null, row.financialMonth || null])
    })
  }

  if (shouldPersist('finance_cash_balance')) {
    await replaceSimpleRows(db, 'finance_cash_balance', state.cashBalanceRecords, async (row, index) => {
      await db.execute(`
      INSERT INTO finance_cash_balance (id, balance_json, balance_date, company_name, bank_name, account_name, account_no_tail, balance_amount, remark, created_by, created_at, updated_by, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE balance_json = VALUES(balance_json), balance_date = VALUES(balance_date), company_name = VALUES(company_name), bank_name = VALUES(bank_name), account_name = VALUES(account_name), account_no_tail = VALUES(account_no_tail), balance_amount = VALUES(balance_amount), remark = VALUES(remark), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [rowId(row, `cash-balance-${index + 1}`), JSON.stringify(toOaExtensionRecord(row, oaStructuredRecordConfigs.cashBalance)), dateOnly(row.balance_date) || '1970-01-01', row.company_name || '', row.bank_name || '', row.account_name || '', row.account_no_tail || '', toNumber(row.balance_amount), row.remark || null, row.created_by == null ? null : String(row.created_by), dateTime(row.created_at) || now(), row.updated_by == null ? null : String(row.updated_by), dateTime(row.updated_at) || now()])
    })
  }
}

let memoryState = createSeedState()
let memoryRevision = 0

const partitionTables: Record<OaStatePartition, string> = {
  dashboard: 'oa_dashboard_record',
  receivable: 'finance_receivable_payable',
  cash: 'finance_cash_flow',
  salary: 'hr_salary_record',
  org: 'oa_org_record',
  vehicle: 'oa_vehicle_record',
  cashBalance: 'finance_cash_balance',
}

async function readRevision(db: mysql.Pool | mysql.PoolConnection, lock = false) {
  const [rows] = await db.query<Array<mysql.RowDataPacket & { revision: number }>>(`SELECT revision FROM oa_module_revision WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, ['default'])
  return Number(rows[0]?.revision || 0)
}

async function writeRevision(db: mysql.Pool | mysql.PoolConnection, revision: number) {
  await db.execute(`
    INSERT INTO oa_module_revision (id, revision, updated_at) VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE revision = VALUES(revision), updated_at = NOW()
  `, ['default', revision])
}

export const oaModuleStore = {
  async getState() {
    const db = getMysqlPool()
    if (!db)
      return { ...cloneState(memoryState), revision: memoryRevision }

    await ensureSchema(db)
    const structured = await loadStructuredState(db)
    if (structured.hasData)
      return { ...cloneState(structured.state), revision: await readRevision(db) }

    const legacy = await loadLegacyState(db)
    const state = legacy || (isDatabaseRequired() ? normalizeState() : createSeedState())
    await ensureSchema(db)
    await withMysqlTransaction(db, connection => persistStructuredState(connection, state))
    return { ...cloneState(state), revision: await readRevision(db) }
  },

  async replaceState(payload: Partial<OaModuleState>) {
    const state = normalizeState(payload)
    const db = getMysqlPool()
    if (!db) {
      memoryState = cloneState(state)
      memoryRevision += 1
      return { ...cloneState(memoryState), revision: memoryRevision }
    }

    await ensureSchema(db)
    await withMysqlTransaction(db, async (connection) => {
      await persistStructuredState(connection, state)
      const revision = await readRevision(connection, true) + 1
      await writeRevision(connection, revision)
      state.revision = revision
    })
    return cloneState(state)
  },

  async replacePartition(partition: OaStatePartition, rows: unknown, expectedRevision: number) {
    if (!(partition in partitionTables))
      throw new Error('OA 数据分区不合法')
    if (!Array.isArray(rows))
      throw new Error('OA 分区数据必须为数组')
    if (partition === 'salary') {
      const currentState = await oaModuleStore.getState()
      assertSalaryPartitionUpdate(currentState.modules.salary, rows as Array<Record<string, any>>)
    }
    const db = getMysqlPool()
    if (!db) {
      if (expectedRevision !== memoryRevision)
        throw new Error('OA 数据已被其他操作更新，请刷新后重试')
      if (partition === 'cashBalance')
        memoryState.cashBalanceRecords = cloneValue(rows)
      else
        memoryState.modules[partition] = cloneValue(rows)
      memoryRevision += 1
      return { ...cloneState(memoryState), revision: memoryRevision }
    }
    await ensureSchema(db)
    let revision = 0
    await withMysqlTransaction(db, async (connection) => {
      const currentRevision = await readRevision(connection, true)
      if (expectedRevision !== currentRevision)
        throw new Error('OA 数据已被其他操作更新，请刷新后重试')
      const state = normalizeState()
      if (partition === 'cashBalance')
        state.cashBalanceRecords = cloneValue(rows)
      else
        state.modules[partition] = cloneValue(rows)
      await persistStructuredState(connection, state, new Set([partitionTables[partition]]))
      revision = currentRevision + 1
      await writeRevision(connection, revision)
      await connection.execute(`
        INSERT INTO oa_module_revision_log (revision, partition_key, rows_json, created_at)
        VALUES (?, ?, CAST(? AS JSON), NOW())
      `, [revision, partition, JSON.stringify(rows)])
    })
    const state = await this.getState()
    state.revision = revision
    return state
  },

  async registerReceipt(input: RegisterReceiptInput) {
    const state = await this.getState()
    const receipt = addReceiptToState(state, input)
    if (input.cashBalanceId)
      postReceiptToCashBalance(state, receipt, input.cashBalanceId, input.handler)
    await this.replaceState(state)
    return cloneValue(receipt)
  },

  async allocateReceipt(receiptId: string, input: AllocateReceiptInput) {
    const allocations = input?.allocations
    if (!Array.isArray(allocations) || allocations.length === 0)
      throw new Error('至少选择一张应收单进行核销')
    if (!String(input.cashBalanceId || '').trim())
      throw new Error('请选择核销对应的收款账户')
    if (!String(input.allocationBatchId || '').trim())
      throw new Error('核销批次号不能为空')
    const state = await this.getState()
    const receipt = state.modules.cash.find(row => String(row.id) === String(receiptId))
    if (!receipt || receipt.flowType !== '来款登记')
      throw new Error('来款记录不存在')
    if (receipt.status === '作废')
      throw new Error('作废来款不能核销')
    const priorBatch = (Array.isArray(receipt.allocationBatches) ? receipt.allocationBatches : [])
      .find((item: any) => String(item.id) === String(input.allocationBatchId))
    if (priorBatch) {
      return {
        receipt: cloneValue(receipt),
        receivables: cloneValue(state.modules.receivable.filter(row =>
          (priorBatch.receivableIds || []).some((id: string) => String(id) === String(row.id)),
        )),
        cashBalance: cloneValue(state.cashBalanceRecords.find(row => String(row.id) === String(receipt.cashBalanceId))),
      }
    }

    const allocationTotal = allocations.reduce((total, item) => total + Number(item.amount || 0), 0)
    if (allocations.some(item => !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0))
      throw new Error('核销金额必须大于0')
    if (allocationTotal > Number(receipt.unrecognizedAmount || 0) + 0.00001)
      throw new Error('核销金额不能超过未认领金额')

    const resolved = allocations.map((allocation) => {
      const receivable = state.modules.receivable.find(row => String(row.id) === String(allocation.receivableId))
      if (!receivable || receivable.billType !== '应收' || receivable.status === '作废')
        throw new Error(`应收单 ${allocation.receivableId} 不存在或不可核销`)
      if (Number(allocation.amount) > Number(receivable.unpaidAmount || 0) + 0.00001)
        throw new Error(`应收单 ${receivable.code || receivable.id} 的核销金额超过未收金额`)
      return { allocation, receivable }
    })

    const timestamp = now()
    const cashBalance = postReceiptToCashBalance(state, receipt, input.cashBalanceId, input.handler)
    receipt.allocations = Array.isArray(receipt.allocations) ? receipt.allocations : []
    for (const { allocation, receivable } of resolved) {
      const amount = Number(Number(allocation.amount).toFixed(2))
      receivable.paidAmount = Number((Number(receivable.paidAmount || 0) + amount).toFixed(2))
      receivable.unpaidAmount = Number(Math.max(0, Number(receivable.amount || 0) - receivable.paidAmount).toFixed(2))
      receivable.status = receivable.unpaidAmount <= 0 ? '已结清' : '部分收款'
      receipt.allocations.push({
        id: `allocation-${receipt.id}-${receipt.allocations.length + 1}`,
        receivableId: receivable.id,
        receivableCode: receivable.code,
        amount,
        remark: allocation.remark || '',
        allocationBatchId: input.allocationBatchId,
        cashBalanceId: cashBalance.id,
        cashBalanceAccountName: cashBalanceDisplayName(cashBalance),
        accountNo: cashBalance.account_no_tail || '',
        allocatedAt: timestamp,
        allocatedBy: input.handler || '',
      })
    }
    receipt.recognizedAmount = Number((Number(receipt.recognizedAmount || 0) + allocationTotal).toFixed(2))
    receipt.unrecognizedAmount = Number(Math.max(0, Number(receipt.incomeAmount || 0) - receipt.recognizedAmount).toFixed(2))
    receipt.status = receiptStatus(receipt.recognizedAmount, Number(receipt.incomeAmount || 0))
    receipt.allocationBatches = Array.isArray(receipt.allocationBatches) ? receipt.allocationBatches : []
    receipt.allocationBatches.push({
      id: input.allocationBatchId,
      cashBalanceId: cashBalance.id,
      amount: Number(allocationTotal.toFixed(2)),
      receivableIds: resolved.map(item => String(item.receivable.id)),
      receivableCodes: resolved.map(item => String(item.receivable.code || item.receivable.id)),
      allocatedAt: timestamp,
      allocatedBy: input.handler || '',
    })
    const balanceMovement = (cashBalance.balanceMovements || [])
      .find((item: any) => item.type === 'RECEIPT' && String(item.receiptId) === String(receipt.id))
    if (balanceMovement) {
      balanceMovement.receivableCodes = [...new Set(receipt.allocations.map((item: any) => item.receivableCode).filter(Boolean))]
      balanceMovement.allocatedAmount = receipt.recognizedAmount
      balanceMovement.unrecognizedAmount = receipt.unrecognizedAmount
    }
    await this.replaceState(state)
    return {
      receipt: cloneValue(receipt),
      receivables: cloneValue(resolved.map(item => item.receivable)),
      cashBalance: cloneValue(cashBalance),
    }
  },

  async createPaymentInstruction(input: CreatePaymentInstructionInput) {
    validatePaymentInstruction(input)
    const state = await this.getState()
    const requestNo = String(input.paymentRequestNo).trim()
    const fingerprint = paymentFingerprint(input)
    const existing = state.modules.cash.find(row => row.paymentRequestNo === requestNo)
    if (existing) {
      if (existing.paymentFingerprint === fingerprint)
        return cloneValue(existing)
      throw new Error('付款请求号已被其他付款内容使用')
    }

    const pendingPayments = state.modules.cash.filter(row => row.flowType === '付款执行' && unsettledPaymentStatuses.includes(row.paymentStatus))
    const resolved = input.allocations.map((allocation) => {
      const payable = state.modules.receivable.find(row => String(row.id) === String(allocation.payableId))
      if (!payable || payable.billType !== '应付' || ['作废', '已结清'].includes(payable.status))
        throw new Error(`应付单 ${allocation.payableId} 不存在或不可付款`)
      const reserved = pendingPayments.reduce((total, payment) => total + (payment.paymentAllocations || [])
        .filter((item: any) => String(item.payableId) === String(allocation.payableId))
        .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0), 0)
      if (Number(allocation.amount) > Number(payable.unpaidAmount || 0) - reserved + 0.00001)
        throw new Error(`应付单 ${payable.code || payable.id} 的可付金额不足`)
      return { allocation, payable }
    })
    const amount = Number(resolved.reduce((total, item) => total + Number(item.allocation.amount), 0).toFixed(2))
    const cashBalance = input.cashBalanceId
      ? state.cashBalanceRecords.find(row => String(row.id) === String(input.cashBalanceId))
      : undefined
    if (input.cashBalanceId && !cashBalance)
      throw new Error('所选现金余额账户不存在')
    if (cashBalance && String(cashBalance.company_name) !== String(input.companyName || '').trim())
      throw new Error('付款主体与现金余额账户不匹配')
    if (cashBalance && String(cashBalance.account_no_tail) !== String(input.accountNo || '').trim())
      throw new Error('付款账号与现金余额账户不匹配')
    const reservedCashBalance = pendingPayments
      .filter(row => String(row.cashBalanceId || '') === String(input.cashBalanceId || ''))
      .reduce((total, row) => total + Number(row.paymentAmount || 0), 0)
    if (cashBalance && amount > Number(cashBalance.balance_amount || 0) - reservedCashBalance + 0.00001)
      throw new Error('付款账号可用余额不足')
    const paymentDate = dateOnly(input.paymentDate)!
    const latestAccountFlow = state.modules.cash
      .filter(row => row.accountName === input.accountName && !unsettledPaymentStatuses.includes(row.paymentStatus))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    const openingBalance = Number(latestAccountFlow?.currentBalance || 0)
    const payment = {
      id: `payment-${requestNo}`,
      code: `PMT-${requestNo}`,
      cashBalanceId: input.cashBalanceId,
      companyName: String(input.companyName || '').trim(),
      accountNo: String(input.accountNo || '').trim(),
      accountName: String(input.accountName).trim(),
      accountType: input.accountType || '银行账户',
      openingBalance,
      incomeAmount: 0,
      expenseAmount: 0,
      currentBalance: openingBalance,
      date: paymentDate,
      flowType: '付款执行',
      paymentRequestNo: requestNo,
      paymentFingerprint: fingerprint,
      paymentAmount: amount,
      payeeName: String(input.payeeName).trim(),
      counterpartyName: String(input.payeeName).trim(),
      paymentMethod: input.paymentMethod || '银行转账',
      paymentStatus: 'PENDING',
      paymentAllocations: resolved.map(({ allocation, payable }) => ({
        payableId: payable.id,
        payableCode: payable.code,
        amount: Number(Number(allocation.amount).toFixed(2)),
        remark: allocation.remark || '',
      })),
      handler: input.handler || '',
      status: '待支付',
      remark: input.remark || '',
      sourceApprovalId: input.sourceApprovalId,
      financialYear: new Date(paymentDate).getFullYear(),
      financialMonth: new Date(paymentDate).getMonth() + 1,
    }
    state.modules.cash.unshift(payment)
    await this.replaceState(state)
    return cloneValue(payment)
  },

  async markPaymentSubmitted(paymentId: string, submission: BankPaymentSubmission) {
    const state = await this.getState()
    const payment = state.modules.cash.find(row => String(row.id) === String(paymentId) && row.flowType === '付款执行')
    if (!payment)
      throw new Error('付款指令不存在')
    if (payment.paymentStatus === 'PROCESSING') {
      if (payment.providerRequestId === submission.providerRequestId)
        return cloneValue(payment)
      throw new Error('付款指令已提交到其他渠道请求')
    }
    if (payment.paymentStatus !== 'PENDING')
      throw new Error('仅待支付指令可以提交银行')
    payment.paymentStatus = 'PROCESSING'
    payment.status = '银行处理中'
    payment.paymentProvider = submission.provider
    payment.providerRequestId = submission.providerRequestId
    payment.providerRawStatus = submission.rawStatus
    payment.submittedAt = submission.acceptedAt
    await this.replaceState(state)
    return cloneValue(payment)
  },

  async confirmPayment(paymentId: string, input: ConfirmPaymentInput) {
    const state = await this.getState()
    const payment = state.modules.cash.find(row => String(row.id) === String(paymentId) && row.flowType === '付款执行')
    if (!payment)
      throw new Error('付款指令不存在')
    const bankSerialNo = String(input.bankSerialNo || '').trim()
    if (!bankSerialNo)
      throw new Error('银行流水号不能为空')
    if (payment.paymentStatus === 'SUCCESS') {
      if (payment.bankSerialNo === bankSerialNo)
        return cloneValue(payment)
      throw new Error('付款已成功，不能更换银行流水号')
    }
    if (!unsettledPaymentStatuses.includes(payment.paymentStatus))
      throw new Error('当前付款状态不能确认支付')
    const duplicateBankFlow = state.modules.cash.find(row =>
      row.id !== payment.id
      && row.accountName === payment.accountName
      && String(row.bankSerialNo || '').trim().toLowerCase() === bankSerialNo.toLowerCase(),
    )
    if (duplicateBankFlow)
      throw new Error('该付款账户下的银行流水号已存在')

    const resolved = (payment.paymentAllocations || []).map((allocation: any) => {
      const payable = state.modules.receivable.find(row => String(row.id) === String(allocation.payableId))
      if (!payable || payable.billType !== '应付' || payable.status === '作废')
        throw new Error(`应付单 ${allocation.payableCode || allocation.payableId} 不存在或不可付款`)
      if (Number(allocation.amount) > Number(payable.unpaidAmount || 0) + 0.00001)
        throw new Error(`应付单 ${payable.code || payable.id} 的未付金额不足`)
      return { allocation, payable }
    })
    const priorFlow = state.modules.cash
      .filter(row => row.id !== payment.id && row.accountName === payment.accountName && !unsettledPaymentStatuses.includes(row.paymentStatus))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
    const priorBalance = Number(priorFlow?.currentBalance || payment.openingBalance || 0)
    const paymentAmount = Number(payment.paymentAmount || 0)
    const cashBalance = payment.cashBalanceId
      ? state.cashBalanceRecords.find(row => String(row.id) === String(payment.cashBalanceId))
      : undefined
    if (payment.cashBalanceId && !cashBalance)
      throw new Error('付款关联的现金余额账户不存在')
    if (cashBalance && Number(cashBalance.balance_amount || 0) < paymentAmount)
      throw new Error('付款账号余额不足')
    if (priorFlow && priorBalance < paymentAmount)
      throw new Error('付款账户余额不足')

    for (const { allocation, payable } of resolved) {
      const amount = Number(allocation.amount)
      payable.paidAmount = Number((Number(payable.paidAmount || 0) + amount).toFixed(2))
      payable.unpaidAmount = Number(Math.max(0, Number(payable.amount || 0) - payable.paidAmount).toFixed(2))
      payable.status = payable.unpaidAmount <= 0 ? '已结清' : '部分付款'
    }
    payment.bankSerialNo = bankSerialNo
    payment.expenseAmount = paymentAmount
    payment.currentBalance = Number((priorBalance - paymentAmount).toFixed(2))
    payment.paymentStatus = 'SUCCESS'
    payment.status = '已支付'
    payment.handler = input.handler || payment.handler
    payment.paidAt = input.paidAt || now()
    if (cashBalance) {
      cashBalance.balance_amount = Number((Number(cashBalance.balance_amount || 0) - paymentAmount).toFixed(2))
      cashBalance.updated_at = now()
      cashBalance.updated_by = input.handler || payment.handler || '付款确认'
    }
    await this.replaceState(state)
    return { payment: cloneValue(payment), payables: cloneValue(resolved.map(item => item.payable)) }
  },

  async failPayment(paymentId: string, reason: string) {
    const state = await this.getState()
    const payment = state.modules.cash.find(row => String(row.id) === String(paymentId) && row.flowType === '付款执行')
    if (!payment)
      throw new Error('付款指令不存在')
    if (payment.paymentStatus === 'FAILED')
      return cloneValue(payment)
    if (!unsettledPaymentStatuses.includes(payment.paymentStatus))
      throw new Error('仅待支付或银行处理中指令可标记失败')
    if (!String(reason || '').trim())
      throw new Error('付款失败原因不能为空')
    payment.paymentStatus = 'FAILED'
    payment.status = '支付失败'
    payment.failureReason = String(reason).trim()
    payment.failedAt = now()
    await this.replaceState(state)
    return cloneValue(payment)
  },

  async handleBankPaymentCallback(input: BankPaymentCallbackInput) {
    if (!String(input.eventId || '').trim())
      throw new Error('回调事件号不能为空')
    const state = await this.getState()
    const payment = state.modules.cash.find(row => row.flowType === '付款执行' && row.paymentRequestNo === String(input.paymentRequestNo || '').trim())
    if (!payment)
      throw new Error('付款指令不存在')
    if (Array.isArray(payment.callbackEventIds) && payment.callbackEventIds.includes(input.eventId))
      return cloneValue(payment)

    if (input.status === 'SUCCESS')
      await this.confirmPayment(payment.id, { bankSerialNo: String(input.bankSerialNo || ''), paidAt: input.paidAt, handler: '银行回调' })
    else
      await this.failPayment(payment.id, input.reason || '银行返回支付失败')
    const latestState = await this.getState()
    const latest = latestState.modules.cash.find(row => String(row.id) === String(payment.id))!
    latest.callbackEventIds = [...new Set([...(latest.callbackEventIds || []), input.eventId])]
    latest.lastCallbackAt = now()
    await this.replaceState(latestState)
    return cloneValue(latest)
  },
}

function approvalCounterparty(instance: ApprovalInstance, form: Record<string, any>) {
  return String(
    form.counterparty
    || form.supplierName
    || form.vendorName
    || form.payeeName
    || form.customerName
    || form.employeeName
    || instance.applicantName
    || '待补充',
  )
}

export async function updateApprovalRecord(instance: ApprovalInstance, status: string) {
  const financePolicy = approvalFinancePolicy(instance.businessType)
  const moduleKey = ['REGISTER_RECEIPT', 'CREATE_RECEIVABLE'].includes(financePolicy.action) ? undefined : approvalOaModuleKey(instance.businessType)
  const createsSettlement = ['CREATE_PAYABLE', 'CREATE_RECEIVABLE'].includes(financePolicy.action)
  const registersReceipt = financePolicy.action === 'REGISTER_RECEIPT'
  if (!moduleKey && !createsSettlement && !registersReceipt)
    return
  const state = await oaModuleStore.getState()
  const form = instance.formSnapshot || instance.payload || {}
  if (moduleKey) {
    let record = state.modules[moduleKey].find(item => String(item.id) === String(instance.businessId) || String(item.approvalInstanceId) === instance.id)
    if (!record) {
      const amount = Number(instance.amount || form.amount || 0)
      record = {
        ...form,
        id: instance.businessId,
        code: instance.businessNo || instance.code,
        title: instance.title,
        approvalType: APPROVAL_BUSINESS_MAP.get(instance.businessType)?.label || instance.approvalType,
        businessType: instance.businessType,
        applicant: instance.applicantName,
        employeeName: form.employeeName || instance.applicantName,
        department: instance.deptName,
        amount,
        expenseAmount: amount,
        unpaidAmount: amount,
        totalAmount: amount,
        netSalary: amount,
        totalFee: amount,
        name: form.name || instance.title,
        date: form.occurredDate || instance.submittedAt.slice(0, 10),
        financialYear: new Date(form.occurredDate || instance.submittedAt).getFullYear(),
        financialMonth: new Date(form.occurredDate || instance.submittedAt).getMonth() + 1,
        source: '企业微信',
      }
      state.modules[moduleKey].unshift(record)
    }
    record.approvalInstanceId = instance.id
    record.approvalNo = instance.code
    record.approvalStatus = status
    record.status = moduleKey === 'salary'
      ? ({ 审批中: '待审批', 已确认: '审批通过', 已驳回: '审批驳回', 已撤回: '草稿' } as Record<string, string>)[status]
      : status

    if (moduleKey === 'receivable' && instance.businessType === 'payment') {
      const amount = Number(instance.amount || form.amount || 0)
      const billDate = String(form.paymentDate || form.occurredDate || form.billDate || instance.submittedAt).slice(0, 10)
      Object.assign(record, {
        ...form,
        counterparty: approvalCounterparty(instance, form),
        billType: '应付',
        amount,
        paidAmount: Number(record.paidAmount || 0),
        unpaidAmount: Math.max(0, amount - Number(record.paidAmount || 0)),
        dueDate: billDate,
        date: billDate,
        status: status === '已确认' ? (Number(record.paidAmount || 0) > 0 ? '部分付款' : '未付') : status,
        financialYear: new Date(billDate).getFullYear(),
        financialMonth: new Date(billDate).getMonth() + 1,
        remark: form.remark || form.description || instance.title,
      })
    }
  }

  if (createsSettlement) {
    const rows = state.modules.receivable
    const sourceApprovalId = instance.id
    const isReceivable = financePolicy.action === 'CREATE_RECEIVABLE'
    const billType = isReceivable ? '应收' : '应付'
    const existing = rows.find(item => String(item.sourceApprovalId || item.approvalInstanceId) === sourceApprovalId && item.billType === billType)
    if (status === '已确认') {
      const amount = Number(instance.amount || form.amount || 0)
      const billDate = String(form.occurredDate || form.billDate || instance.approvedAt || instance.submittedAt).slice(0, 10)
      const dueDate = String(form.dueDate || form.paymentDate || billDate).slice(0, 10)
      const counterparty = approvalCounterparty(instance, form)
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error(`${billType}金额必须大于0`)
      if (Number.isNaN(new Date(billDate).getTime()) || Number.isNaN(new Date(dueDate).getTime()))
        throw new Error(`${billType}业务日期或到期日期不合法`)
      if (isReceivable && !String(form.counterparty || form.customerName || '').trim())
        throw new Error('应收客户不能为空')
      const settlement = {
        ...(existing || {}),
        id: existing?.id || `${isReceivable ? 'receivable' : 'payable'}-${sourceApprovalId}`,
        code: existing?.code || `${isReceivable ? 'AR' : 'AP'}-${instance.businessNo || instance.code}`,
        counterparty,
        billType,
        amount,
        paidAmount: Number(existing?.paidAmount || 0),
        unpaidAmount: Math.max(0, amount - Number(existing?.paidAmount || 0)),
        dueDate,
        date: billDate,
        relatedBill: instance.businessNo || instance.businessId,
        status: Number(existing?.paidAmount || 0) > 0 ? (isReceivable ? '部分收款' : '部分付款') : (isReceivable ? '未收' : '未付'),
        approvalStatus: status,
        approvalInstanceId: instance.id,
        sourceApprovalId,
        sourceBusinessType: instance.businessType,
        sourceBusinessId: instance.businessId,
        financialYear: new Date(billDate).getFullYear(),
        financialMonth: new Date(billDate).getMonth() + 1,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        receivingAccount: form.receivingAccount,
        accountType: form.accountType,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        bankName: form.bankName,
        bankProvince: form.bankProvince,
        bankCity: form.bankCity,
        bankBranchName: form.bankBranchName,
        attachmentFiles: form.attachmentFiles,
        attachmentName: form.attachmentName,
        remark: form.remark || form.description || instance.title,
      }
      if (existing)
        Object.assign(existing, settlement)
      else
        rows.unshift(settlement)
    }
    else if (existing && ['已驳回', '已撤回'].includes(status)) {
      existing.status = '作废'
      existing.approvalStatus = status
    }
  }

  if (registersReceipt) {
    const existingReceipt = state.modules.cash.find(row => row.sourceApprovalId === instance.id)
    if (status === '已确认' && !existingReceipt) {
      addReceiptToState(state, {
        accountName: form.accountName || form.receiptAccount || form.bankAccount || '待确认收款账户',
        amount: Number(instance.amount || form.amount || 0),
        receiptDate: form.receiptDate || form.occurredDate || instance.approvedAt || instance.submittedAt,
        payerName: form.payerName || form.customerName || form.counterparty || instance.applicantName,
        bankSerialNo: form.bankSerialNo || form.bankFlowNo || instance.code,
        accountType: form.accountType || '银行账户',
        receiptType: form.receiptType || '待确认',
        handler: instance.applicantName,
        remark: form.description || form.remark || instance.title,
        sourceApprovalId: instance.id,
        sourceBusinessId: instance.businessId,
      })
    }
    else if (existingReceipt && ['已驳回', '已撤回'].includes(status)) {
      if (Number(existingReceipt.recognizedAmount || 0) > 0)
        throw new Error('该来款已经核销，不能随审批直接撤回')
      existingReceipt.status = '作废'
      existingReceipt.approvalStatus = status
    }
  }
  await oaModuleStore.replaceState(state)
}

APPROVAL_BUSINESS_MAP.forEach((_config, businessType) => {
  if (!approvalOaModuleKey(businessType) && approvalFinancePolicy(businessType).action === 'NONE')
    return
  registerApprovalBusinessHandler(businessType, {
    onPending: instance => updateApprovalRecord(instance, '审批中'),
    onApproved: instance => updateApprovalRecord(instance, '已确认'),
    onRejected: instance => updateApprovalRecord(instance, '已驳回'),
    onRevoked: instance => updateApprovalRecord(instance, '已撤回'),
  })
})
