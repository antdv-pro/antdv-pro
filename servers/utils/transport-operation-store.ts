import type mysql from 'mysql2/promise'
import { createHash } from 'node:crypto'
import { calculateTransportFreightExcludingTax } from '../../shared/transport-freight'
import { resolveRuntimeJsonDataFile } from './data-paths'
import { readJsonFile, writeJsonFile } from './json-store'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'

export type TransportOperationRecordType = 'orders' | 'fuels' | 'etc' | 'driverPayrolls' | 'maintenance' | 'inventoryMovements' | 'vehicleLoans' | 'baseCompanies' | 'baseCustomers' | 'baseVehicles' | 'baseCrews' | 'baseRoutes'

export type TransportOperationDataset = Record<TransportOperationRecordType, any[]>

const recordTypes: TransportOperationRecordType[] = ['orders', 'fuels', 'etc', 'driverPayrolls', 'maintenance', 'inventoryMovements', 'vehicleLoans', 'baseCompanies', 'baseCustomers', 'baseVehicles', 'baseCrews', 'baseRoutes']
const dataFile = resolveRuntimeJsonDataFile('transport-operation.json')
let schemaReady: Promise<void> | undefined
let replacementQueue: Promise<unknown> = Promise.resolve()

async function ensureColumn(db: mysql.Pool, table: string, column: string, definition: string) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  catch (error: any) {
    if (error?.code !== 'ER_DUP_FIELDNAME')
      throw error
  }
}

export function getTransportOperationRevision(data: TransportOperationDataset) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

function isOrderDerivedRoute(record: any) {
  const source = String(record?.source ?? '').trim()
  return source === '运输订单' || source === '运输订单自动建档'
}

function normalizeDataset(data: Partial<TransportOperationDataset>): TransportOperationDataset {
  const dataset: TransportOperationDataset = {
    baseCompanies: Array.isArray(data.baseCompanies) ? data.baseCompanies : [],
    orders: Array.isArray(data.orders) ? data.orders : [],
    fuels: Array.isArray(data.fuels) ? data.fuels : [],
    etc: Array.isArray(data.etc) ? data.etc : [],
    driverPayrolls: Array.isArray(data.driverPayrolls) ? data.driverPayrolls : [],
    maintenance: Array.isArray(data.maintenance) ? data.maintenance : [],
    inventoryMovements: Array.isArray(data.inventoryMovements) ? data.inventoryMovements : [],
    vehicleLoans: Array.isArray(data.vehicleLoans) ? data.vehicleLoans : [],
    baseCustomers: Array.isArray(data.baseCustomers) ? data.baseCustomers : [],
    baseVehicles: Array.isArray(data.baseVehicles) ? data.baseVehicles : [],
    baseCrews: Array.isArray(data.baseCrews) ? data.baseCrews : [],
    baseRoutes: Array.isArray(data.baseRoutes) ? data.baseRoutes.filter(record => !isOrderDerivedRoute(record)) : [],
  }
  dedupeBaseCustomers(dataset)
  normalizeDatasetPlateNos(dataset)
  syncCustomersFromOrders(dataset)
  syncVehiclesFromOrders(dataset)
  return dataset
}

function normalizeCustomerName(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

/** Keep one customer archive per normalized name while retaining fields from duplicate rows. */
function dedupeBaseCustomers(dataset: TransportOperationDataset) {
  const byName = new Map<string, Record<string, any>>()
  dataset.baseCustomers = dataset.baseCustomers.filter((record) => {
    const name = normalizeCustomerName(record?.name)
    if (!name)
      return true
    record.name = name
    const existing = byName.get(name)
    if (!existing) {
      byName.set(name, record)
      return true
    }
    Object.entries(record).forEach(([key, value]) => {
      if ((existing as any)[key] == null || String((existing as any)[key]).trim() === '')
        (existing as any)[key] = value
    })
    return false
  })
}

function normalizePlateNo(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '')
}

function normalizeDatasetPlateNos(dataset: TransportOperationDataset) {
  const plateNoCollections: TransportOperationRecordType[] = ['orders', 'fuels', 'etc', 'maintenance', 'inventoryMovements', 'vehicleLoans', 'driverPayrolls']
  plateNoCollections.forEach((type) => {
    dataset[type].forEach((record) => {
      if (record?.plateNo != null)
        record.plateNo = normalizePlateNo(record.plateNo)
      if (record?.plateNos != null) {
        record.plateNos = String(record.plateNos)
          .split(/([、,，/])/)
          .map((part: string) => /[、,，/]/.test(part) ? part : normalizePlateNo(part))
          .join('')
      }
    })
  })

  dataset.baseVehicles.forEach((record) => {
    if (record?.code != null)
      record.code = normalizePlateNo(record.code)
    if (record?.plateNo != null)
      record.plateNo = normalizePlateNo(record.plateNo)
    if (String(record?.area ?? '').trim() === '格尔木')
      record.area = '青海'
  })
  dataset.baseCrews.forEach((record) => {
    if (record?.plateNo != null)
      record.plateNo = normalizePlateNo(record.plateNo)
  })
}

function syncCustomersFromOrders(dataset: TransportOperationDataset) {
  const names = new Set(dataset.baseCustomers.map(record => normalizeCustomerName(record?.name)).filter(Boolean))
  let maxCustomerNo = dataset.baseCustomers.reduce((max, record) => {
    const match = String(record?.code ?? '').match(/^KH(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  dataset.orders.forEach((order) => {
    const name = normalizeCustomerName(order?.customer ?? order?.customerName)
    if (!name || names.has(name))
      return
    maxCustomerNo += 1
    dataset.baseCustomers.push({
      code: `KH${String(maxCustomerNo).padStart(3, '0')}`,
      name,
      area: '',
      contact: '',
      bidAmount: '',
      bidStartDate: '',
      progress: '0',
      status: '合作中',
      updatedAt: new Date().toISOString().slice(0, 10),
      source: '运输订单',
    })
    names.add(name)
  })
  return dataset
}

function isUsablePlateNo(value: unknown) {
  return /^\p{Script=Han}[A-Z][A-Z0-9]{5,6}$/u.test(normalizePlateNo(value).toUpperCase())
}

function syncVehiclesFromOrders(dataset: TransportOperationDataset) {
  const plates = new Set(dataset.baseVehicles
    .flatMap(record => [record?.code, record?.plateNo])
    .map(normalizePlateNo)
    .filter(Boolean))

  dataset.orders.forEach((order) => {
    const plateNo = normalizePlateNo(order?.plateNo).toUpperCase()
    if (!isUsablePlateNo(plateNo) || plates.has(plateNo))
      return
    dataset.baseVehicles.push({
      code: plateNo,
      plateNo,
      trailerNo: normalizePlateNo(order?.trailerNo),
      area: plateNo.slice(0, 1),
      driverName: String(order?.driver || '').trim(),
      escortName: String(order?.escort || '').trim(),
      status: '运营中',
      updatedAt: String(order?.shipDate || '').slice(0, 10),
      source: '运输订单自动建档',
    })
    plates.add(plateNo)
  })
}

function recordKey(type: TransportOperationRecordType, record: any, index: number) {
  if (type === 'etc' && record?.sourceFileHash)
    return `ETC-${String(record.sourceFileHash).slice(0, 32)}-${record.sourceFileRow || index + 1}`
  if (record?.code)
    return String(record.code)
  if (record?.contractNo)
    return String(record.contractNo)
  if (record?.id != null)
    return String(record.id)
  return `${type}-${index + 1}`
}

function assertUniqueRecordKeys(dataset: TransportOperationDataset) {
  for (const type of recordTypes) {
    const keys = new Set<string>()
    dataset[type].forEach((record, index) => {
      const key = recordKey(type, record, index)
      if (keys.has(key))
        throw new Error(`运输运营 ${type} 存在重复标识: ${key}`)
      keys.add(key)
    })
  }

  const summarySources = new Map<string, string>()
  dataset.etc.forEach((record) => {
    const summaryNo = String(record?.summaryNo ?? '').trim()
    if (!summaryNo)
      return
    const source = record?.sourceFileHash ? `file:${String(record.sourceFileHash)}` : 'legacy'
    const existingSource = summarySources.get(summaryNo)
    if (existingSource && existingSource !== source)
      throw new Error(`ETC汇总单号 ${summaryNo} 已存在，禁止重复录入`)
    summarySources.set(summaryNo, source)
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

function normalizeDate(value: unknown) {
  const text = String(value || '').trim()
  return text ? text.slice(0, 10) : null
}

function normalizeDateTime(value: unknown) {
  const text = String(value || '').trim()
  if (!text)
    return null
  return text.length <= 10 ? `${text} 00:00:00` : text.replace('T', ' ').slice(0, 19)
}

function parseMonth(value: unknown, fallbackDate?: unknown) {
  const text = String(value || '').trim()
  const match = text.match(/(\d{4})\D?(\d{1,2})/)
  if (match)
    return { year: Number(match[1]), month: Number(match[2]) }

  const date = String(fallbackDate || '').trim()
  const dateMatch = date.match(/(\d{4})-(\d{1,2})/)
  if (dateMatch)
    return { year: Number(dateMatch[1]), month: Number(dateMatch[2]) }

  return { year: null, month: null }
}

async function ensureSchema(db: mysql.Pool) {
  if (schemaReady)
    return schemaReady

  schemaReady = createSchema(db).catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

async function createSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS transport_base_data (
      id VARCHAR(96) PRIMARY KEY,
      category VARCHAR(32) NOT NULL,
      code VARCHAR(64) NOT NULL,
      record_json JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_transport_base_data_category_code (category, code),
      KEY idx_transport_base_data_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
      created_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_transport_maintenance_plate_date (plate_no, repair_date),
      KEY idx_transport_maintenance_month (financial_year, financial_month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS transport_inventory_movement (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NULL,
      code VARCHAR(64) NOT NULL UNIQUE,
      movement_date DATE NOT NULL,
      movement_type VARCHAR(16) NOT NULL,
      part_name VARCHAR(128) NOT NULL,
      specification VARCHAR(128) NULL,
      quantity DECIMAL(14, 3) NOT NULL DEFAULT 0,
      unit_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
      amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
      plate_no VARCHAR(32) NULL,
      maintenance_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_transport_inventory_part (part_name, specification),
      KEY idx_transport_inventory_date (movement_date),
      KEY idx_transport_inventory_plate (plate_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS transport_operation_record (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      record_type VARCHAR(64) NOT NULL,
      record_key VARCHAR(128) NOT NULL,
      record_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      UNIQUE KEY uk_transport_operation_record (record_type, record_key),
      KEY idx_transport_operation_type (record_type),
      KEY idx_transport_operation_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureColumn(db, 'transport_maintenance_order', 'created_by', 'VARCHAR(64) NULL')
  await db.query(`
    UPDATE transport_maintenance_order
    SET created_by = COALESCE(created_by, JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.createdBy')))
    WHERE created_by IS NULL AND record_json IS NOT NULL
  `)
}

async function loadLegacyDataset(db: mysql.Pool) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(`
    SELECT record_type, record_json
    FROM transport_operation_record
    WHERE deleted_at IS NULL
    ORDER BY id ASC
  `)
  const data = normalizeDataset({})
  rows.forEach((row: any) => {
    if (!recordTypes.includes(row.record_type))
      return
    data[row.record_type as TransportOperationRecordType].push(parseJson(row.record_json, {}))
  })
  return data
}

async function loadStructuredDataset(db: mysql.Pool) {
  const data = normalizeDataset({})
  const [
    [orders],
    [fuels],
    [etc],
    [driverPayrolls],
    [maintenance],
    [inventoryMovements],
    [vehicleLoans],
    [baseData],
  ] = await Promise.all([
    db.query<mysql.RowDataPacket[]>('SELECT record_json FROM transport_order WHERE deleted_at IS NULL ORDER BY ship_date DESC, created_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT record_json FROM transport_fuel_record WHERE deleted_at IS NULL ORDER BY fuel_time DESC, created_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT record_json FROM transport_etc_record WHERE deleted_at IS NULL ORDER BY pass_time DESC, created_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT payroll_json FROM transport_driver_payroll WHERE deleted_at IS NULL ORDER BY updated_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT record_json, created_by FROM transport_maintenance_order WHERE deleted_at IS NULL ORDER BY repair_date DESC, created_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT record_json FROM transport_inventory_movement WHERE deleted_at IS NULL ORDER BY movement_date DESC, created_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT record_json FROM transport_vehicle_loan WHERE deleted_at IS NULL ORDER BY start_date DESC, created_at DESC'),
    db.query<mysql.RowDataPacket[]>('SELECT category, record_json FROM transport_base_data ORDER BY updated_at DESC'),
  ])

  data.orders = orders.map((row: any) => parseJson(row.record_json, {}))
  data.fuels = fuels.map((row: any) => parseJson(row.record_json, {}))
  data.etc = etc.map((row: any) => parseJson(row.record_json, {}))
  data.driverPayrolls = driverPayrolls.map((row: any) => parseJson(row.payroll_json, {}))
  data.maintenance = maintenance.map((row: any) => {
    const record = parseJson(row.record_json, {})
    return { ...record, createdBy: row.created_by || record.createdBy }
  })
  data.inventoryMovements = inventoryMovements.map((row: any) => parseJson(row.record_json, {}))
  data.vehicleLoans = vehicleLoans.map((row: any) => parseJson(row.record_json, {}))
  const categoryMap: Record<string, keyof TransportOperationDataset> = { company: 'baseCompanies', customer: 'baseCustomers', vehicle: 'baseVehicles', crew: 'baseCrews', route: 'baseRoutes' }
  for (const row of baseData as any[]) {
    const type = categoryMap[row.category]
    if (type)
      data[type]!.push(parseJson(row.record_json, {}))
  }

  return syncCustomersFromOrders(data)
}

function hasDatasetRows(dataset: TransportOperationDataset) {
  return recordTypes.some(type => dataset[type].length > 0)
}

function assertCompleteReplacement(payload: Partial<TransportOperationDataset>) {
  const missing = recordTypes.filter(type => !Array.isArray(payload[type]))
  if (missing.length)
    throw new Error(`运输运营整批保存缺少分类: ${missing.join(', ')}`)
}

function assertNonDestructiveReplacement(current: TransportOperationDataset, next: TransportOperationDataset, confirmed: boolean) {
  if (confirmed)
    return
  const destructive = recordTypes.filter((type) => {
    const currentCount = current[type].length
    return currentCount > 0 && next[type].length < currentCount / 2
  })
  if (destructive.length)
    throw new Error(`运输运营数据大幅缩减，需显式确认: ${destructive.join(', ')}`)
}

// Reads return the full operational dataset, so keep hot data in-process until a write invalidates it.
const datasetCacheTtlMs = 5 * 60_000
let datasetCache: { db: mysql.Pool, expiresAt: number, data: TransportOperationDataset } | undefined

export function invalidateTransportOperationCache() {
  datasetCache = undefined
}

export async function ensureTransportOperationSchema(db: mysql.Pool) {
  await ensureSchema(db)
}

function readDatasetCache(db: mysql.Pool) {
  if (!datasetCache || datasetCache.db !== db || datasetCache.expiresAt <= Date.now())
    return undefined
  return datasetCache.data
}

function writeDatasetCache(db: mysql.Pool, data: TransportOperationDataset) {
  datasetCache = { db, data, expiresAt: Date.now() + datasetCacheTtlMs }
}

async function persistStructuredDataset(db: mysql.Pool | mysql.PoolConnection, dataset: TransportOperationDataset) {
  await db.execute('UPDATE transport_order SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_fuel_record SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_etc_record SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_driver_payroll SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_maintenance_order SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_inventory_movement SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_vehicle_loan_payment SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('UPDATE transport_vehicle_loan SET deleted_at = NOW() WHERE deleted_at IS NULL')
  await db.execute('DELETE FROM transport_base_data')

  const baseGroups: Array<[string, any[]]> = [
    ['company', dataset.baseCompanies || []],
    ['customer', dataset.baseCustomers],
    ['vehicle', dataset.baseVehicles],
    ['crew', dataset.baseCrews],
    ['route', dataset.baseRoutes],
  ]
  for (const [category, records] of baseGroups) {
    for (const [index, record] of records.entries()) {
      const code = record.code || `${category}-${index + 1}`
      await db.execute('INSERT INTO transport_base_data (id, category, code, record_json) VALUES (?, ?, ?, CAST(? AS JSON))', [`${category}:${code}`, category, code, JSON.stringify(record)])
    }
  }

  for (const [index, record] of dataset.orders.entries()) {
    const month = parseMonth(record.financeMonth, record.shipDate)
    await db.execute(`
      INSERT INTO transport_order (
        id, record_json, code, financial_year, financial_month, ship_date, customer_name, plate_no, trailer_no,
        driver_name, escort_name, route_name, loading_address, unloading_address, order_type, cargo_name,
        sent_weight, received_weight, distance_km, pricing_formula, freight_price, freight_total, tax_rate,
        taxed_freight, planned_fuel_quantity, actual_fuel_quantity, actual_fuel_amount, etc_fee, receipt_status,
        settlement_status, transport_status, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at
      )
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), ship_date = VALUES(ship_date), customer_name = VALUES(customer_name), plate_no = VALUES(plate_no), trailer_no = VALUES(trailer_no), driver_name = VALUES(driver_name), escort_name = VALUES(escort_name), route_name = VALUES(route_name), freight_total = VALUES(freight_total), taxed_freight = VALUES(taxed_freight), actual_fuel_quantity = VALUES(actual_fuel_quantity), actual_fuel_amount = VALUES(actual_fuel_amount), etc_fee = VALUES(etc_fee), transport_status = VALUES(transport_status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), remark = VALUES(remark), updated_at = NOW(), deleted_at = NULL
    `, [
      record.id || record.code || recordKey('orders', record, index),
      JSON.stringify(record),
      record.code || recordKey('orders', record, index),
      month.year,
      month.month,
      normalizeDate(record.shipDate) || '1970-01-01',
      record.customer || '',
      record.plateNo || record.vehicleInfo || '',
      record.trailerNo || '',
      record.driver || '',
      record.escort || '',
      record.routeLine || '',
      record.loadingAddress || '',
      record.unloadingAddress || '',
      record.orderType || '',
      record.cargoName || '',
      toNumber(record.sentWeight),
      toNumber(record.receivedWeight),
      toNumber(record.distance || record.mileage),
      record.pricingFormula || '吨位×单价',
      toNumber(record.freightPrice),
      toNumber(record.freightTotal),
      toNumber(record.taxRate || 9) / 100,
      toNumber(record.taxedFreight) || calculateTransportFreightExcludingTax(toNumber(record.freightTotal)),
      toNumber(record.plannedFuelConsumption),
      toNumber(record.actualFuelVolume),
      toNumber(record.actualFuelAmount),
      toNumber(record.etcFee),
      record.receiptStatus || '',
      record.settlementStatus || '',
      record.status || '装车',
      record.approvalStatus || null,
      record.approvalInstanceId || null,
      record.remark || '',
    ])
  }

  for (const [index, record] of dataset.fuels.entries()) {
    const month = parseMonth(record.month, record.date)
    await db.execute(`
      INSERT INTO transport_fuel_record (id, record_json, code, financial_year, financial_month, fuel_time, plate_no, location, product, quantity, amount, driver_name, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), fuel_time = VALUES(fuel_time), plate_no = VALUES(plate_no), location = VALUES(location), product = VALUES(product), quantity = VALUES(quantity), amount = VALUES(amount), driver_name = VALUES(driver_name), updated_at = NOW(), deleted_at = NULL
    `, [record.id || record.code || recordKey('fuels', record, index), JSON.stringify(record), record.code || recordKey('fuels', record, index), month.year, month.month, normalizeDateTime(record.date) || '1970-01-01 00:00:00', record.plateNo || '', record.location || '', record.product || '', toNumber(record.quantity), toNumber(record.amount), record.driver || ''])
  }

  for (const [index, record] of dataset.etc.entries()) {
    const month = parseMonth(record.month, record.updatedAt)
    const storageKey = recordKey('etc', record, index)
    await db.execute(`
      INSERT INTO transport_etc_record (id, record_json, code, financial_year, financial_month, pass_time, road_section, plate_no, card_no, invoice_no, amount, status, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), pass_time = VALUES(pass_time), road_section = VALUES(road_section), plate_no = VALUES(plate_no), card_no = VALUES(card_no), invoice_no = VALUES(invoice_no), amount = VALUES(amount), status = VALUES(status), updated_at = NOW(), deleted_at = NULL
    `, [storageKey, JSON.stringify(record), storageKey, month.year, month.month, normalizeDateTime(record.updatedAt) || '1970-01-01 00:00:00', record.name || '', record.plateNo || '', record.cardNo || '', record.invoiceNo || '', toNumber(record.amount), record.status || ''])
  }

  for (const [index, record] of dataset.driverPayrolls.entries()) {
    const month = parseMonth(record.financeMonth || record.month, record.updatedAt)
    await db.execute(`
      INSERT INTO transport_driver_payroll (id, code, payroll_json, driver_name, plate_no, financial_year, financial_month, amount, status, approval_status, approval_instance_id, created_at, updated_at, deleted_at)
      VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE payroll_json = VALUES(payroll_json), driver_name = VALUES(driver_name), plate_no = VALUES(plate_no), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), amount = VALUES(amount), status = VALUES(status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), updated_at = NOW(), deleted_at = NULL
    `, [record.id || record.code || recordKey('driverPayrolls', record, index), record.code || recordKey('driverPayrolls', record, index), JSON.stringify(record), record.name || record.driver || '', String(record.owner || record.plateNo || '').split('/')[0].trim(), month.year, month.month, toNumber(record.amount || record.netSalary), record.status || '', record.approvalStatus || null, record.approvalInstanceId || null])
  }

  for (const [index, record] of dataset.maintenance.entries()) {
    const month = parseMonth(record.financialMonth, record.repairDate)
    const { permissions: _permissions, ...persistedRecord } = record
    await db.execute(`
      INSERT INTO transport_maintenance_order (id, record_json, code, plate_no, trailer_no, repair_date, financial_year, financial_month, project, shop, mileage, items, pay_type, driver_name, amount, status, approval_status, approval_instance_id, remark, created_by, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), plate_no = VALUES(plate_no), trailer_no = VALUES(trailer_no), repair_date = VALUES(repair_date), financial_year = VALUES(financial_year), financial_month = VALUES(financial_month), project = VALUES(project), shop = VALUES(shop), mileage = VALUES(mileage), items = VALUES(items), pay_type = VALUES(pay_type), driver_name = VALUES(driver_name), amount = VALUES(amount), status = VALUES(status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), remark = VALUES(remark), created_by = COALESCE(created_by, VALUES(created_by)), updated_at = NOW(), deleted_at = NULL
    `, [record.id || record.code || recordKey('maintenance', record, index), JSON.stringify(persistedRecord), record.code || `WX${record.id || index + 1}`, record.plateNo || '', record.trailerNo || '', normalizeDate(record.repairDate) || '1970-01-01', month.year, month.month, record.project || '', record.shop || '', toNumber(record.mileage), record.items || '', record.payType || '', record.driver || '', toNumber(record.amount), record.status || '', record.approvalStatus || null, record.approvalInstanceId || null, record.remark || '', record.createdBy == null ? null : String(record.createdBy)])
  }

  for (const [index, record] of dataset.inventoryMovements.entries()) {
    await db.execute(`
      INSERT INTO transport_inventory_movement (id, record_json, code, movement_date, movement_type, part_name, specification, quantity, unit_price, amount, plate_no, maintenance_id, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), movement_date = VALUES(movement_date), movement_type = VALUES(movement_type), part_name = VALUES(part_name), specification = VALUES(specification), quantity = VALUES(quantity), unit_price = VALUES(unit_price), amount = VALUES(amount), plate_no = VALUES(plate_no), maintenance_id = VALUES(maintenance_id), updated_at = NOW(), deleted_at = NULL
    `, [record.id || record.code || recordKey('inventoryMovements', record, index), JSON.stringify(record), record.code || recordKey('inventoryMovements', record, index), normalizeDate(record.movementDate) || '1970-01-01', record.type || '', record.partName || '', record.specification || '', toNumber(record.quantity), toNumber(record.unitPrice), toNumber(record.amount), record.plateNo || '', record.maintenanceId || null])
  }

  for (const [index, record] of dataset.vehicleLoans.entries()) {
    await db.execute(`
      INSERT INTO transport_vehicle_loan (id, record_json, contract_no, plate_no, trailer_no, lender, loan_amount, principal_amount, annual_rate, total_periods, start_date, first_due_date, monthly_payment, owner, status, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), plate_no = VALUES(plate_no), trailer_no = VALUES(trailer_no), lender = VALUES(lender), loan_amount = VALUES(loan_amount), principal_amount = VALUES(principal_amount), annual_rate = VALUES(annual_rate), total_periods = VALUES(total_periods), start_date = VALUES(start_date), first_due_date = VALUES(first_due_date), monthly_payment = VALUES(monthly_payment), owner = VALUES(owner), status = VALUES(status), approval_status = VALUES(approval_status), approval_instance_id = VALUES(approval_instance_id), remark = VALUES(remark), updated_at = NOW(), deleted_at = NULL
    `, [record.id || record.contractNo || recordKey('vehicleLoans', record, index), JSON.stringify(record), record.contractNo || record.code || recordKey('vehicleLoans', record, index), record.plateNo || '', record.trailerNo || '', record.lender || '', toNumber(record.loanAmount), toNumber(record.principalAmount), toNumber(record.annualRate), Number(record.totalPeriods || 0), normalizeDate(record.startDate) || '1970-01-01', normalizeDate(record.firstDueDate) || '1970-01-01', toNumber(record.monthlyPayment), record.owner || '', record.status || '还款中', record.approvalStatus || null, record.approvalInstanceId || null, record.remark || ''])

    for (const payment of Array.isArray(record.payments) ? record.payments : []) {
      await db.execute(`
        INSERT INTO transport_vehicle_loan_payment (id, loan_id, period_no, payment_date, amount, principal, interest, method, voucher_no, remark, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
        ON DUPLICATE KEY UPDATE payment_date = VALUES(payment_date), amount = VALUES(amount), principal = VALUES(principal), interest = VALUES(interest), method = VALUES(method), voucher_no = VALUES(voucher_no), remark = VALUES(remark), updated_at = NOW(), deleted_at = NULL
      `, [payment.id || `${record.id || record.contractNo}-p-${payment.periodNo}`, record.id || record.contractNo || recordKey('vehicleLoans', record, index), Number(payment.periodNo || 0), normalizeDate(payment.paymentDate) || '1970-01-01', toNumber(payment.amount), toNumber(payment.principal), toNumber(payment.interest), payment.method || '', payment.voucherNo || '', payment.remark || ''])
    }
  }
}

export const transportOperationStore = {
  async getDataset() {
    const db = getMysqlPool()
    if (!db) {
      if (isDatabaseRequired())
        throw new Error('数据库为必需配置，运输运营数据禁止读取本地 JSON')
      return normalizeDataset(readJsonFile<Partial<TransportOperationDataset>>(dataFile, {}))
    }

    await ensureSchema(db)
    const cached = readDatasetCache(db)
    if (cached)
      return cached

    const structured = await loadStructuredDataset(db)
    if (hasDatasetRows(structured)) {
      writeDatasetCache(db, structured)
      return structured
    }

    const legacy = await loadLegacyDataset(db)
    if (hasDatasetRows(legacy)) {
      await withMysqlTransaction(db, connection => persistStructuredDataset(connection, legacy))
      writeDatasetCache(db, legacy)
      return legacy
    }

    return normalizeDataset({})
  },

  async replaceDataset(payload: Partial<TransportOperationDataset> & { confirmDestructiveReplace?: boolean, expectedRevision?: string }) {
    const operation = replacementQueue.catch(() => undefined).then(async () => {
      const dataset = normalizeDataset(payload)
      assertUniqueRecordKeys(dataset)
      const db = getMysqlPool()
      if (!db && isDatabaseRequired())
        throw new Error('数据库为必需配置，运输运营数据禁止写入本地 JSON')
      const current = await this.getDataset()
      if (payload.expectedRevision && payload.expectedRevision !== getTransportOperationRevision(current))
        throw new Error('数据已被其他用户更新，请刷新后重新录入')

      if (!db) {
        writeJsonFile(dataFile, dataset)
        return dataset
      }

      await ensureSchema(db)
      assertCompleteReplacement(payload)
      assertNonDestructiveReplacement(current, dataset, payload.confirmDestructiveReplace === true)
      await withMysqlTransaction(db, connection => persistStructuredDataset(connection, dataset))
      writeDatasetCache(db, dataset)
      return dataset
    })
    replacementQueue = operation
    return operation
  },
}
