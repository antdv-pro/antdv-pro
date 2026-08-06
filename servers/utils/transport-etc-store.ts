import type mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'
import { analyzeEtcActualRoutes } from '../../shared/transport-etc-route-analysis'
import { normalizePagination, paginateRows } from '../services/pagination'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { ensureTransportOperationSchema, invalidateTransportOperationCache, transportOperationStore } from './transport-operation-store'

export interface TransportEtcRecord extends Record<string, unknown> {
  code: string
  summaryNo?: string
  name?: string
  status?: string
  amount?: string | number
  updatedAt?: string
  month?: string
  plateNo?: string
  invoiceNo?: string
  cardNo?: string
  sourceFileHash?: string
  sourceFileName?: string
  sourceFileRow?: string
  storageId?: string
  entryInfo?: string
  exitInfo?: string
  routeLine?: string
}

export interface TransportEtcFilters {
  keyword?: unknown
  status?: unknown
  financialYear?: unknown
  financialMonth?: unknown
  startDate?: unknown
  endDate?: unknown
  includeAnalysis?: unknown
}

interface NormalizedEtcFilters {
  keyword: string
  status: string
  financialYear: number
  financialMonth: number
  startDate: string
  endDate: string
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function number(value: unknown) {
  const result = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(result) ? result : 0
}

function parseJson(value: unknown) {
  if (typeof value === 'string')
    return JSON.parse(value) as TransportEtcRecord
  return (value && typeof value === 'object' ? value : {}) as TransportEtcRecord
}

function normalizeFilters(input: TransportEtcFilters = {}): NormalizedEtcFilters {
  const financialYear = Math.trunc(Number(input.financialYear) || 0)
  const financialMonth = Math.trunc(Number(input.financialMonth) || 0)
  const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : ''
  return {
    keyword: text(input.keyword).toLowerCase(),
    status: text(input.status),
    financialYear: financialYear >= 2000 && financialYear <= 2200 ? financialYear : 0,
    financialMonth: financialMonth >= 1 && financialMonth <= 12 ? financialMonth : 0,
    startDate: date(input.startDate),
    endDate: date(input.endDate),
  }
}

function financialPeriod(record: TransportEtcRecord) {
  const direct = text(record.month).match(/(\d{4})\D?(\d{1,2})/)
  const date = text(record.updatedAt).match(/(\d{4})-(\d{1,2})/)
  const match = direct || date
  return match ? { year: Number(match[1]), month: Number(match[2]) } : { year: 0, month: 0 }
}

export function filterTransportEtcRows(rows: TransportEtcRecord[], input: TransportEtcFilters = {}) {
  const filters = normalizeFilters(input)
  return rows.filter((record) => {
    if (filters.keyword) {
      const searchable = [record.summaryNo, record.code, record.plateNo, record.cardNo, record.invoiceNo, record.name, record.entryInfo, record.exitInfo]
      if (!searchable.some(value => text(value).toLowerCase().includes(filters.keyword)))
        return false
    }
    if (filters.status && text(record.status) !== filters.status)
      return false
    const period = financialPeriod(record)
    if (filters.financialYear && period.year !== filters.financialYear)
      return false
    if (filters.financialMonth && period.month !== filters.financialMonth)
      return false
    const occurredAt = text(record.updatedAt).slice(0, 10)
    if (filters.startDate && occurredAt < filters.startDate)
      return false
    if (filters.endDate && occurredAt > filters.endDate)
      return false
    return true
  }).sort((left, right) => text(right.updatedAt).localeCompare(text(left.updatedAt)) || text(right.code).localeCompare(text(left.code)))
}

export function summarizeTransportEtcRows(rows: TransportEtcRecord[]) {
  const routeMap = new Map<string, { route: string, amount: number, count: number }>()
  rows.forEach((record) => {
    const route = text(record.name || record.routeLine || (record.entryInfo && record.exitInfo ? `${record.entryInfo} 至 ${record.exitInfo}` : '')) || '未识别路线'
    const item = routeMap.get(route) || { route, amount: 0, count: 0 }
    item.amount += number(record.amount)
    item.count += 1
    routeMap.set(route, item)
  })
  return {
    summary: {
      recordCount: rows.length,
      totalAmount: rows.reduce((total, record) => total + number(record.amount), 0),
      pendingCount: rows.filter(record => /待|草稿|驳回/.test(text(record.status))).length,
      vehicleCount: new Set(rows.map(record => text(record.plateNo)).filter(Boolean)).size,
    },
    routeRanking: [...routeMap.values()].sort((left, right) => right.amount - left.amount).slice(0, 8),
  }
}

function includesActualRouteAnalysis(input: TransportEtcFilters) {
  return !['false', '0'].includes(text(input.includeAnalysis).toLowerCase())
}

async function analyzeMysqlActualRoutes(
  db: mysql.Pool,
  query: { where: string, params: Array<string | number> },
) {
  const [[etcRows], [routeRows]] = await Promise.all([
    db.query<mysql.RowDataPacket[]>(`SELECT record_json FROM transport_etc_record WHERE ${query.where}`, query.params),
    db.query<mysql.RowDataPacket[]>(`SELECT record_json FROM transport_base_data WHERE category = 'route' ORDER BY updated_at DESC`),
  ])
  const records = etcRows.map((row: any) => parseJson(row.record_json))
  if (!records.length)
    return []

  const plates = [...new Set(records.map(record => text(record.plateNo)).filter(Boolean))]
  const dates = records.map(record => text(record.updatedAt).slice(0, 10)).filter(Boolean).sort()
  let orders: Array<Record<string, unknown>> = []
  if (plates.length && dates.length) {
    const placeholders = plates.map(() => '?').join(',')
    const [orderRows] = await db.query<mysql.RowDataPacket[]>(`
      SELECT record_json
      FROM transport_order
      WHERE deleted_at IS NULL
        AND ship_date BETWEEN ? AND ?
        AND plate_no IN (${placeholders})
    `, [dates[0], dates.at(-1), ...plates])
    orders = orderRows.map((row: any) => parseJson(row.record_json))
  }
  const routes = routeRows.map((row: any) => parseJson(row.record_json))
  return analyzeEtcActualRoutes(records, routes, orders)
}

function buildMysqlFilter(input: TransportEtcFilters = {}) {
  const filters = normalizeFilters(input)
  const clauses = ['deleted_at IS NULL']
  const params: Array<string | number> = []
  if (filters.keyword) {
    clauses.push(`(LOWER(code) LIKE ? OR LOWER(plate_no) LIKE ? OR LOWER(card_no) LIKE ? OR LOWER(invoice_no) LIKE ? OR LOWER(road_section) LIKE ? OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.summaryNo'))) LIKE ?)`)
    for (let index = 0; index < 6; index += 1)
      params.push(`%${filters.keyword}%`)
  }
  if (filters.status) {
    clauses.push('status = ?')
    params.push(filters.status)
  }
  if (filters.financialYear) {
    clauses.push('financial_year = ?')
    params.push(filters.financialYear)
  }
  if (filters.financialMonth) {
    clauses.push('financial_month = ?')
    params.push(filters.financialMonth)
  }
  if (filters.startDate) {
    clauses.push('pass_time >= ?')
    params.push(`${filters.startDate} 00:00:00`)
  }
  if (filters.endDate) {
    clauses.push('pass_time < DATE_ADD(?, INTERVAL 1 DAY)')
    params.push(filters.endDate)
  }
  return { where: clauses.join(' AND '), params }
}

const mysqlRouteLabel = `COALESCE(
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.routeLine')), ''),
  CASE
    WHEN JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.name')) NOT IN ('', '通行费', 'ETC费用')
      THEN JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.name'))
  END,
  NULLIF(CONCAT_WS(' 至 ',
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.entryInfo')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.exitInfo')), '')
  ), ''),
  NULLIF(road_section, ''),
  '未识别路线'
)`

function recordStorageId(record: TransportEtcRecord, index: number) {
  if (record.sourceFileHash)
    return `ETC-${text(record.sourceFileHash).slice(0, 32)}-${record.sourceFileRow || index + 1}`
  return text(record.code) || `etc-${index + 1}`
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function normalizeTransportEtcManualRecord(value: unknown): TransportEtcRecord {
  const input = parseJson(value)
  const updatedAt = text(input.updatedAt).slice(0, 10)
  const plateNo = text(input.plateNo)
  const entryInfo = text(input.entryInfo)
  const exitInfo = text(input.exitInfo)
  const amount = number(input.amount)
  const dateParts = updatedAt.split('-').map(Number)
  const date = new Date(`${updatedAt}T00:00:00`)
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(updatedAt)
    || Number.isNaN(date.getTime())
    || date.getFullYear() !== dateParts[0]
    || date.getMonth() + 1 !== dateParts[1]
    || date.getDate() !== dateParts[2]) {
    throw new Error('通行日期格式无效')
  }
  if (!plateNo)
    throw new Error('车牌号不能为空')
  if (!entryInfo || !exitInfo)
    throw new Error('入口信息和出口信息不能为空')
  if (amount <= 0)
    throw new Error('ETC金额必须大于0')
  const code = text(input.code) || `ETC-MANUAL-${randomUUID()}`
  const name = `${entryInfo} 至 ${exitInfo}`
  return {
    ...input,
    code,
    summaryNo: text(input.summaryNo),
    name,
    routeLine: name,
    entryInfo,
    exitInfo,
    owner: `${plateNo} / ${text(input.cardNo) || text(input.invoiceNo) || '-'}`,
    status: text(input.status) || '已录入',
    amount: formatMoney(amount),
    updatedAt,
    month: `${updatedAt.slice(0, 4)}-${updatedAt.slice(5, 7)}`,
    plateNo,
    invoiceNo: text(input.invoiceNo),
    cardNo: text(input.cardNo),
    sourceFileHash: undefined,
    sourceFileName: undefined,
    sourceFileRow: undefined,
    source: 'manual',
  }
}

function normalizeImportRows(value: unknown) {
  if (!Array.isArray(value) || !value.length)
    throw new Error('没有可导入的ETC记录')
  if (value.length > 20000)
    throw new Error('单次最多导入20000条ETC记录')
  const rows = value.map((item, index) => ({ ...parseJson(item), storageId: undefined }))
  const ids = new Set<string>()
  const summaries = new Map<string, string>()
  rows.forEach((record, index) => {
    const id = recordStorageId(record, index)
    if (!record.code || !record.updatedAt || number(record.amount) <= 0)
      throw new Error(`第${index + 1}条ETC记录缺少编号、通行日期或有效金额`)
    if (ids.has(id))
      throw new Error(`ETC记录 ${id} 重复`)
    ids.add(id)
    const summaryNo = text(record.summaryNo)
    const sourceHash = text(record.sourceFileHash)
    if (summaryNo && summaries.has(summaryNo) && summaries.get(summaryNo) !== sourceHash)
      throw new Error(`ETC汇总单号 ${summaryNo} 来自多个文件`)
    if (summaryNo)
      summaries.set(summaryNo, sourceHash)
  })
  return rows
}

function mysqlRecordParams(record: TransportEtcRecord, index: number) {
  const period = financialPeriod(record)
  const storageId = recordStorageId(record, index)
  return [
    storageId,
    JSON.stringify(record),
    storageId,
    period.year || null,
    period.month || null,
    text(record.updatedAt) || '1970-01-01 00:00:00',
    text(record.name || record.routeLine),
    text(record.plateNo),
    text(record.cardNo),
    text(record.invoiceNo),
    number(record.amount),
    text(record.status) || '已导入',
  ]
}

async function assertMysqlImportIsNew(connection: mysql.PoolConnection, rows: TransportEtcRecord[]) {
  const ids = rows.map(recordStorageId)
  const sourceHashes = [...new Set(rows.map(row => text(row.sourceFileHash)).filter(Boolean))]
  const summaryNos = [...new Set(rows.map(row => text(row.summaryNo)).filter(Boolean))]
  const clauses: string[] = []
  const params: string[] = []
  if (ids.length) {
    clauses.push(`id IN (${ids.map(() => '?').join(',')})`)
    params.push(...ids)
  }
  if (sourceHashes.length) {
    clauses.push(`JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.sourceFileHash')) IN (${sourceHashes.map(() => '?').join(',')})`)
    params.push(...sourceHashes)
  }
  if (summaryNos.length) {
    clauses.push(`JSON_UNQUOTE(JSON_EXTRACT(record_json, '$.summaryNo')) IN (${summaryNos.map(() => '?').join(',')})`)
    params.push(...summaryNos)
  }
  const [existing] = await connection.query<mysql.RowDataPacket[]>(`SELECT id FROM transport_etc_record WHERE deleted_at IS NULL AND (${clauses.join(' OR ')}) LIMIT 1`, params)
  if (existing.length)
    throw new Error('文件或汇总单号已导入，禁止重复导入')
}

async function persistMysqlRows(connection: mysql.PoolConnection, rows: TransportEtcRecord[]) {
  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400)
    const placeholders = chunk.map(() => '(?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)').join(',')
    await connection.query(`
      INSERT INTO transport_etc_record (id, record_json, code, financial_year, financial_month, pass_time, road_section, plate_no, card_no, invoice_no, amount, status, created_at, updated_at, deleted_at)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), pass_time=VALUES(pass_time), road_section=VALUES(road_section), plate_no=VALUES(plate_no), card_no=VALUES(card_no), invoice_no=VALUES(invoice_no), amount=VALUES(amount), status=VALUES(status), updated_at=NOW(), deleted_at=NULL
    `, chunk.flatMap(mysqlRecordParams))
  }
}

async function saveRows(rows: TransportEtcRecord[]) {
  const db = getMysqlPool()
  if (db) {
    await ensureTransportOperationSchema(db)
    await withMysqlTransaction(db, async (connection) => {
      await assertMysqlImportIsNew(connection, rows)
      await persistMysqlRows(connection, rows)
    })
    invalidateTransportOperationCache()
    return
  }
  if (isDatabaseRequired())
    throw new Error('数据库为必需配置，ETC数据禁止写入本地 JSON')
  const dataset = await transportOperationStore.getDataset()
  const existingIds = new Set((dataset.etc as TransportEtcRecord[]).map(recordStorageId))
  const existingSummaries = new Set((dataset.etc as TransportEtcRecord[]).map(row => text(row.summaryNo)).filter(Boolean))
  if (rows.some((row, index) => existingIds.has(recordStorageId(row, index)) || (row.summaryNo && existingSummaries.has(text(row.summaryNo)))))
    throw new Error('文件、记录编号或汇总单号已存在，禁止重复导入')
  await transportOperationStore.replaceDataset({ ...dataset, etc: [...rows, ...dataset.etc] })
}

export const transportEtcStore = {
  async listPage(current: unknown, pageSize: unknown, filters: TransportEtcFilters = {}) {
    const page = normalizePagination(current, pageSize, 100)
    const db = getMysqlPool()
    if (db) {
      await ensureTransportOperationSchema(db)
      const query = buildMysqlFilter(filters)
      const [[countRows], [recordRows], [summaryRows], [routeRows], [facetRows], actualRouteAnalysis] = await Promise.all([
        db.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS total FROM transport_etc_record WHERE ${query.where}`, query.params),
        db.query<mysql.RowDataPacket[]>(`SELECT id, record_json FROM transport_etc_record WHERE ${query.where} ORDER BY pass_time DESC, created_at DESC LIMIT ? OFFSET ?`, [...query.params, page.pageSize, page.offset]),
        db.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS recordCount, COALESCE(SUM(amount), 0) AS totalAmount, COUNT(DISTINCT NULLIF(plate_no, '')) AS vehicleCount, COALESCE(SUM(CASE WHEN status LIKE '%待%' OR status LIKE '%草稿%' OR status LIKE '%驳回%' THEN 1 ELSE 0 END), 0) AS pendingCount FROM transport_etc_record WHERE ${query.where}`, query.params),
        db.query<mysql.RowDataPacket[]>(`SELECT ${mysqlRouteLabel} AS route, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count FROM transport_etc_record WHERE ${query.where} GROUP BY ${mysqlRouteLabel} ORDER BY amount DESC LIMIT 8`, query.params),
        db.query<mysql.RowDataPacket[]>('SELECT DISTINCT financial_year AS financialYear, status FROM transport_etc_record WHERE deleted_at IS NULL'),
        includesActualRouteAnalysis(filters) ? analyzeMysqlActualRoutes(db, query) : Promise.resolve([]),
      ])
      const summary = summaryRows[0] || {}
      return {
        records: recordRows.map((row: any) => ({ ...parseJson(row.record_json), storageId: String(row.id) })),
        total: Number(countRows[0]?.total || 0),
        current: page.current,
        pageSize: page.pageSize,
        summary: {
          recordCount: Number(summary.recordCount || 0),
          totalAmount: Number(summary.totalAmount || 0),
          pendingCount: Number(summary.pendingCount || 0),
          vehicleCount: Number(summary.vehicleCount || 0),
        },
        routeRanking: routeRows.map(row => ({ route: String(row.route), amount: Number(row.amount || 0), count: Number(row.count || 0) })),
        actualRouteAnalysis,
        facets: {
          years: [...new Set(facetRows.map(row => Number(row.financialYear)).filter(Boolean))].sort((a, b) => b - a),
          statuses: [...new Set(facetRows.map(row => text(row.status)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
        },
      }
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，ETC数据禁止读取本地 JSON')
    const dataset = await transportOperationStore.getDataset()
    const filteredRows = filterTransportEtcRows(dataset.etc as TransportEtcRecord[], filters)
    const aggregate = summarizeTransportEtcRows(filteredRows)
    const actualRouteAnalysis = includesActualRouteAnalysis(filters)
      ? analyzeEtcActualRoutes(filteredRows, dataset.baseRoutes, dataset.orders)
      : []
    const pageResult = paginateRows(filteredRows, page.current, page.pageSize)
    return {
      ...pageResult,
      records: pageResult.records.map((record, index) => ({
        ...record,
        storageId: recordStorageId(record, page.offset + index),
      })),
      ...aggregate,
      actualRouteAnalysis,
      facets: {
        years: [...new Set((dataset.etc as TransportEtcRecord[]).map(row => financialPeriod(row).year).filter(Boolean))].sort((a, b) => b - a),
        statuses: [...new Set((dataset.etc as TransportEtcRecord[]).map(row => text(row.status)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      },
    }
  },

  async importRows(value: unknown) {
    const rows = normalizeImportRows(value)
    await saveRows(rows)
    return { importedCount: rows.length }
  },

  async createRecord(value: unknown) {
    const record = normalizeTransportEtcManualRecord(value)
    await saveRows([record])
    return record
  },
}
