import type mysql from 'mysql2/promise'
import { financialPeriodKeyFromDate } from '../../shared/business-overview'
import { assertTradeOrderTransition, tradeOrderMutationPermission } from '../../shared/business-status-rules'
import { normalizePagination, paginateRows } from '../services/pagination'
import { resolveRuntimeJsonDataFile } from './data-paths'
import { readJsonFile, writeJsonFile } from './json-store'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'

export interface TradeOrderRecord {
  code: string
  [key: string]: any
}

export interface TradeOrderFilters {
  keyword?: unknown
  year?: unknown
  month?: unknown
  status?: unknown
  plateNo?: unknown
  sortField?: unknown
  sortOrder?: unknown
}

interface NormalizedTradeOrderFilters {
  keyword: string
  year: string
  month: number
  status: string
  plateNo: string
  sortField: string
  sortOrder: 'asc' | 'desc'
}

const dataFile = resolveRuntimeJsonDataFile('trade-orders.json')

function normalizeRows(rows: unknown): TradeOrderRecord[] {
  return Array.isArray(rows)
    ? rows.filter((row): row is TradeOrderRecord => !!row && typeof row === 'object' && !!(row as any).code)
    : []
}

function validateChanges(current: TradeOrderRecord[], upsert: TradeOrderRecord[], deleteCodes: string[]) {
  const currentByCode = new Map(current.map(row => [row.code, row]))
  for (const code of deleteCodes) {
    const existing = currentByCode.get(code)
    if (!existing)
      continue
    const permission = tradeOrderMutationPermission(existing.status)
    if (!permission.allowed)
      throw new Error(permission.reason)
  }
  for (const row of upsert) {
    const existing = currentByCode.get(row.code)
    if (existing) {
      // A full replace commonly sends unchanged rows back. Locked records
      // should only be rejected when their payload is actually modified.
      if (JSON.stringify(existing) === JSON.stringify(row))
        continue
      const permission = tradeOrderMutationPermission(existing.status)
      if (!permission.allowed)
        throw new Error(permission.reason)
      assertTradeOrderTransition(existing.status || '待确认', row.status || existing.status || '待确认')
    }
    else if (row.status) {
      assertTradeOrderTransition(undefined, row.status)
    }
  }
}

const mysqlLoadingDate = 'COALESCE(loading_date, STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.loadingDate\')), \'%Y/%c/%e\'), STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.loadingDate\')), \'%Y-%c-%e\'))'

const sortableFields: Record<string, string> = {
  code: 'code',
  year: `YEAR(DATE_ADD(${mysqlLoadingDate}, INTERVAL 6 DAY))`,
  month: `MONTH(DATE_ADD(${mysqlLoadingDate}, INTERVAL 6 DAY))`,
  loadingDate: mysqlLoadingDate,
  status: 'status',
  carrier: 'JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.carrier\'))',
  plateNo: 'JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.plateNo\'))',
  loadingTon: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.loadingTon\')) AS DECIMAL(18,4))',
  unloadingTon: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.unloadingTon\')) AS DECIMAL(18,4))',
  settlementTon: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.settlementTon\')) AS DECIMAL(18,4))',
  liquidPrice: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.liquidPrice\')) AS DECIMAL(18,4))',
  payableTotal: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.payableTotal\')) AS DECIMAL(18,2))',
  freightTotal: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.freightTotal\')) AS DECIMAL(18,2))',
  receivableLiquidTotal: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.receivableLiquidTotal\')) AS DECIMAL(18,2))',
  profit: 'CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.profit\')) AS DECIMAL(18,2))',
}

function normalizeFilters(filters: TradeOrderFilters = {}): NormalizedTradeOrderFilters {
  const value = (input: unknown) => {
    const result = String(input ?? '').trim()
    return result.startsWith('全部') ? '' : result
  }
  const year = value(filters.year)
  const month = Math.trunc(Number(value(filters.month)))
  const sortField = value(filters.sortField)
  return {
    keyword: value(filters.keyword).toLowerCase(),
    year: /^\d{4}$/.test(year) ? year : '',
    month: month >= 1 && month <= 12 ? month : 0,
    status: value(filters.status),
    plateNo: value(filters.plateNo),
    sortField: sortableFields[sortField] ? sortField : 'loadingDate',
    sortOrder: value(filters.sortOrder).toLowerCase() === 'asc' || value(filters.sortOrder).toLowerCase() === 'ascend' ? 'asc' : 'desc',
  }
}

function filterRows(rows: TradeOrderRecord[], input: TradeOrderFilters = {}) {
  const filters = normalizeFilters(input)
  const filtered = rows.filter((row) => {
    if (filters.keyword) {
      const searchable = [row.code, row.carrier, row.plateNo, row.plannedUnit, row.loadingFactory, row.receiver, row.unloadingStation]
      if (!searchable.some(item => String(item ?? '').toLowerCase().includes(filters.keyword)))
        return false
    }
    const periodKey = financialPeriodKeyFromDate(row.loadingDate)
    if (filters.year && periodKey.slice(0, 4) !== filters.year)
      return false
    if (filters.month && Number(periodKey.slice(4, 6)) !== filters.month)
      return false
    if (filters.status && String(row.status ?? '') !== filters.status)
      return false
    if (filters.plateNo && String(row.plateNo ?? '') !== filters.plateNo)
      return false
    return true
  })
  return filtered.sort((left, right) => compareRows(left, right, filters))
}

function compareRows(left: TradeOrderRecord, right: TradeOrderRecord, filters: NormalizedTradeOrderFilters) {
  const field = filters.sortField
  const leftValue = field === 'year' || field === 'month' ? financialPeriodKeyFromDate(left.loadingDate) : left[field]
  const rightValue = field === 'year' || field === 'month' ? financialPeriodKeyFromDate(right.loadingDate) : right[field]
  const leftComparable = field === 'year' ? String(leftValue).slice(0, 4) : field === 'month' ? String(leftValue).slice(4, 6) : leftValue
  const rightComparable = field === 'year' ? String(rightValue).slice(0, 4) : field === 'month' ? String(rightValue).slice(4, 6) : rightValue
  if (field === 'loadingDate') {
    const result = (Date.parse(String(leftComparable || '')) || 0) - (Date.parse(String(rightComparable || '')) || 0)
    return filters.sortOrder === 'asc' ? result : -result
  }
  const leftNumber = Number(leftComparable)
  const rightNumber = Number(rightComparable)
  const result = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
    ? leftNumber - rightNumber
    : String(leftComparable ?? '').localeCompare(String(rightComparable ?? ''), 'zh-CN')
  return filters.sortOrder === 'asc' ? result : -result
}

function summarizeRows(rows: TradeOrderRecord[]) {
  const sum = (field: string) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0)
  return {
    count: rows.length,
    loadingTon: sum('loadingTon'),
    unloadingTon: sum('unloadingTon'),
    payableTotal: sum('payableTotal'),
    receivableTotal: sum('receivableLiquidTotal'),
    profit: sum('profit'),
  }
}

export function buildTradeOrderAnalytics(rows: TradeOrderRecord[]) {
  const statusMap = new Map<string, { status: string, count: number, receivable: number, profit: number }>()
  const monthMap = new Map<string, { month: string, receivable: number, payable: number, profit: number }>()
  const customerMap = new Map<string, { name: string, count: number, receivable: number, profit: number }>()
  rows.forEach((row) => {
    const status = String(row.status || '未设置')
    const statusItem = statusMap.get(status) || { status, count: 0, receivable: 0, profit: 0 }
    statusItem.count += 1
    statusItem.receivable += Number(row.receivableLiquidTotal || 0)
    statusItem.profit += Number(row.profit || 0)
    statusMap.set(status, statusItem)

    const period = financialPeriodKeyFromDate(row.loadingDate)
    const month = period ? `${period.slice(0, 4)}-${period.slice(4, 6)}` : '未设置'
    const monthItem = monthMap.get(month) || { month, receivable: 0, payable: 0, profit: 0 }
    monthItem.receivable += Number(row.receivableLiquidTotal || 0)
    monthItem.payable += Number(row.payableTotal || 0) + Number(row.freightTotal || 0) + Number(row.cargoLoss || 0)
    monthItem.profit += Number(row.profit || 0)
    monthMap.set(month, monthItem)

    const name = String(row.receiver || row.plannedUnit || '未设置客户').trim()
    const customerItem = customerMap.get(name) || { name, count: 0, receivable: 0, profit: 0 }
    customerItem.count += 1
    customerItem.receivable += Number(row.receivableLiquidTotal || 0)
    customerItem.profit += Number(row.profit || 0)
    customerMap.set(name, customerItem)
  })
  return {
    statuses: [...statusMap.values()].sort((a, b) => b.count - a.count),
    months: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
    customers: [...customerMap.values()].sort((a, b) => b.receivable - a.receivable).slice(0, 8),
  }
}

function facetRows(rows: TradeOrderRecord[]) {
  return {
    years: [...new Set(rows.map(row => financialPeriodKeyFromDate(row.loadingDate).slice(0, 4)).filter(Boolean))].sort((a, b) => Number(b) - Number(a)),
    statuses: [...new Set(rows.map(row => String(row.status ?? '').trim()).filter(Boolean))].sort(),
    plateNos: [...new Set(rows.map(row => String(row.plateNo ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  }
}

function buildMysqlFilter(input: TradeOrderFilters = {}) {
  const filters = normalizeFilters(input)
  const clauses = ['deleted_at IS NULL']
  const params: Array<string | number> = []
  if (filters.keyword) {
    const fields = ['code', 'carrier', 'plateNo', 'plannedUnit', 'loadingFactory', 'receiver', 'unloadingStation']
    clauses.push(`(${fields.map(field => field === 'code' ? 'LOWER(code) LIKE ?' : `LOWER(JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.${field}'))) LIKE ?`).join(' OR ')})`)
    fields.forEach(() => params.push(`%${filters.keyword}%`))
  }
  if (filters.year) {
    clauses.push(`YEAR(DATE_ADD(${mysqlLoadingDate}, INTERVAL 6 DAY)) = ?`)
    params.push(Number(filters.year))
  }
  if (filters.month) {
    clauses.push(`MONTH(DATE_ADD(${mysqlLoadingDate}, INTERVAL 6 DAY)) = ?`)
    params.push(filters.month)
  }
  if (filters.status) {
    clauses.push('status = ?')
    params.push(filters.status)
  }
  if (filters.plateNo) {
    clauses.push('JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.plateNo\')) = ?')
    params.push(filters.plateNo)
  }
  return {
    where: clauses.join(' AND '),
    params,
    orderBy: `${sortableFields[filters.sortField]} ${filters.sortOrder.toUpperCase()}, id DESC`,
  }
}

export const tradeOrderStore = {
  async list() {
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      const [rows] = await db.query<mysql.RowDataPacket[]>(`
        SELECT order_json
        FROM trade_order
        WHERE deleted_at IS NULL
        ORDER BY id DESC
      `)
      return normalizeRows(rows.map((row: any) => typeof row.order_json === 'string' ? JSON.parse(row.order_json) : row.order_json))
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止读取本地 JSON')
    return normalizeRows(readJsonFile<TradeOrderRecord[]>(dataFile, []))
  },

  async listPage(current: unknown, pageSize: unknown, filters: TradeOrderFilters = {}) {
    const page = normalizePagination(current, pageSize)
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      const query = buildMysqlFilter(filters)
      const [[countRow], [rows], [summaryRows], [facetData]] = await Promise.all([
        db.query<Array<mysql.RowDataPacket & { total: number }>>(`SELECT COUNT(*) AS total FROM trade_order WHERE ${query.where}`, query.params),
        db.query<mysql.RowDataPacket[]>(`SELECT order_json FROM trade_order WHERE ${query.where} ORDER BY ${query.orderBy} LIMIT ? OFFSET ?`, [...query.params, page.pageSize, page.offset]),
        db.query<mysql.RowDataPacket[]>(`
          SELECT COUNT(*) AS count,
            COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.loadingTon')) AS DECIMAL(18,4))), 0) AS loadingTon,
            COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.unloadingTon')) AS DECIMAL(18,4))), 0) AS unloadingTon,
            COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.payableTotal')) AS DECIMAL(18,2))), 0) AS payableTotal,
            COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.receivableLiquidTotal')) AS DECIMAL(18,2))), 0) AS receivableTotal,
            COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.profit')) AS DECIMAL(18,2))), 0) AS profit
          FROM trade_order WHERE ${query.where}
        `, query.params),
        db.query<mysql.RowDataPacket[]>(`
          SELECT DISTINCT status,
            JSON_UNQUOTE(JSON_EXTRACT(order_json, '$.plateNo')) AS plateNo,
            YEAR(DATE_ADD(${mysqlLoadingDate}, INTERVAL 6 DAY)) AS financialYear
          FROM trade_order WHERE deleted_at IS NULL
        `),
      ])
      return {
        records: normalizeRows(rows.map((row: any) => typeof row.order_json === 'string' ? JSON.parse(row.order_json) : row.order_json)),
        total: Number(countRow[0]?.total || 0),
        current: page.current,
        pageSize: page.pageSize,
        summary: {
          count: Number(summaryRows[0]?.count || 0),
          loadingTon: Number(summaryRows[0]?.loadingTon || 0),
          unloadingTon: Number(summaryRows[0]?.unloadingTon || 0),
          payableTotal: Number(summaryRows[0]?.payableTotal || 0),
          receivableTotal: Number(summaryRows[0]?.receivableTotal || 0),
          profit: Number(summaryRows[0]?.profit || 0),
        },
        facets: {
          years: [...new Set(facetData.map(row => String(row.financialYear || '')).filter(Boolean))].sort((a, b) => Number(b) - Number(a)),
          statuses: [...new Set(facetData.map(row => String(row.status || '').trim()).filter(Boolean))].sort(),
          plateNos: [...new Set(facetData.map(row => String(row.plateNo || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        },
      }
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止读取本地 JSON')
    const allRows = normalizeRows(readJsonFile<TradeOrderRecord[]>(dataFile, []))
    const filteredRows = filterRows(allRows, filters)
    return {
      ...paginateRows(filteredRows, page.current, page.pageSize),
      summary: summarizeRows(filteredRows),
      facets: facetRows(allRows),
    }
  },

  async listFiltered(filters: TradeOrderFilters = {}) {
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      const query = buildMysqlFilter(filters)
      const [rows] = await db.query<mysql.RowDataPacket[]>(`SELECT order_json FROM trade_order WHERE ${query.where} ORDER BY ${query.orderBy}`, query.params)
      return normalizeRows(rows.map((row: any) => typeof row.order_json === 'string' ? JSON.parse(row.order_json) : row.order_json))
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止读取本地 JSON')
    return filterRows(normalizeRows(readJsonFile<TradeOrderRecord[]>(dataFile, [])), filters)
  },

  async replace(rows: unknown) {
    const data = normalizeRows(rows)
    const db = getMysqlPool()
    if (!db && isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止写入本地 JSON')
    const current = await this.list()
    const nextCodes = new Set(data.map(row => row.code))
    validateChanges(current, data, current.filter(row => !nextCodes.has(row.code)).map(row => row.code))
    if (db) {
      await ensureTradeOrderSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        await connection.execute('UPDATE trade_order SET deleted_at = NOW() WHERE deleted_at IS NULL')
        for (const row of data) {
          await connection.execute(`
          INSERT INTO trade_order (code, order_json, status, loading_date, amount, created_at, updated_at, deleted_at)
          VALUES (?, CAST(? AS JSON), ?, ?, ?, NOW(), NOW(), NULL)
          ON DUPLICATE KEY UPDATE
            order_json = VALUES(order_json),
            status = VALUES(status),
            loading_date = VALUES(loading_date),
            amount = VALUES(amount),
            updated_at = NOW(),
            deleted_at = NULL
        `, [row.code, JSON.stringify(row), row.status || null, row.loadingDate || null, Number(row.receivableLiquidTotal || row.payableTotal || 0)])
        }
      })
      return data
    }

    writeJsonFile(dataFile, data)
    return data
  },

  async applyChanges(input: { upsert?: unknown, deleteCodes?: unknown }) {
    const upsert = normalizeRows(input.upsert)
    const deleteCodes = Array.isArray(input.deleteCodes)
      ? [...new Set(input.deleteCodes.map(String).map(value => value.trim()).filter(Boolean))]
      : []
    const current = await this.list()
    validateChanges(current, upsert, deleteCodes)
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        for (const code of deleteCodes) {
          await connection.execute('UPDATE trade_order SET deleted_at = NOW() WHERE code = ? AND deleted_at IS NULL', [code])
          await connection.execute('INSERT INTO trade_order_revision (order_code, action, snapshot_json, created_at) VALUES (?, ?, NULL, NOW())', [code, 'delete'])
        }
        for (const row of upsert) {
          await connection.execute(`
            INSERT INTO trade_order (code, order_json, status, loading_date, amount, created_at, updated_at, deleted_at)
            VALUES (?, CAST(? AS JSON), ?, ?, ?, NOW(), NOW(), NULL)
            ON DUPLICATE KEY UPDATE order_json = VALUES(order_json), status = VALUES(status), loading_date = VALUES(loading_date), amount = VALUES(amount), updated_at = NOW(), deleted_at = NULL
          `, [row.code, JSON.stringify(row), row.status || null, row.loadingDate || null, Number(row.receivableLiquidTotal || row.payableTotal || 0)])
          await connection.execute('INSERT INTO trade_order_revision (order_code, action, snapshot_json, created_at) VALUES (?, ?, CAST(? AS JSON), NOW())', [row.code, 'upsert', JSON.stringify(row)])
        }
      })
      return this.list()
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止写入本地 JSON')
    const deleted = new Set(deleteCodes)
    const byCode = new Map(current.filter(row => !deleted.has(row.code)).map(row => [row.code, row]))
    upsert.forEach(row => byCode.set(row.code, row))
    const data = [...byCode.values()]
    writeJsonFile(dataFile, data)
    return data
  },
}

async function ensureTradeOrderSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS trade_order (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(128) NOT NULL UNIQUE,
      order_json JSON NOT NULL,
      status VARCHAR(64) NULL,
      loading_date DATE NULL,
      amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_trade_order_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureColumn(db, 'trade_order', 'status', 'VARCHAR(64) NULL')
  await ensureColumn(db, 'trade_order', 'loading_date', 'DATE NULL')
  await ensureColumn(db, 'trade_order', 'amount', 'DECIMAL(18,2) NOT NULL DEFAULT 0')
  await db.query(`
    CREATE TABLE IF NOT EXISTS trade_order_revision (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      order_code VARCHAR(128) NOT NULL,
      action VARCHAR(32) NOT NULL,
      snapshot_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_trade_order_revision_code (order_code, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
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
