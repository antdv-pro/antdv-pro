import type mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { ensureTransportOperationSchema, invalidateTransportOperationCache, transportOperationStore } from './transport-operation-store'

export interface TransportFuelRecord extends Record<string, unknown> {
  code: string
  month?: string
  date?: string
  plateNo?: string
  location?: string
  product?: string
  quantity?: string | number
  quantityUnit?: 'L' | 'kg'
  amount?: string | number
  driver?: string
  status?: string
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
    return JSON.parse(value) as TransportFuelRecord
  return (value && typeof value === 'object' ? value : {}) as TransportFuelRecord
}

function normalizeFuelDate(value: unknown) {
  const normalized = text(value).replace('T', ' ').slice(0, 19)
  const match = normalized.match(/^(20\d{2})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match)
    throw new Error('加油日期格式无效')
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day))
    throw new Error('加油日期格式无效')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function normalizeQuantityUnit(input: TransportFuelRecord) {
  const explicit = text(input.quantityUnit).toLowerCase()
  if (explicit === 'kg' || explicit === '公斤')
    return 'kg' as const
  return /kg|公斤/i.test(text(input.quantity)) ? 'kg' as const : 'L' as const
}

export function normalizeTransportFuelRecord(value: unknown, options: { manual?: boolean } = {}): TransportFuelRecord {
  const input = parseJson(value)
  const date = normalizeFuelDate(input.date)
  const plateNo = text(input.plateNo)
  const location = text(input.location)
  const amount = number(input.amount)
  const quantity = number(input.quantity)
  const quantityUnit = normalizeQuantityUnit(input)
  if (!plateNo)
    throw new Error('车牌号不能为空')
  if (!location)
    throw new Error('加油地点不能为空')
  if (amount <= 0)
    throw new Error('加油金额必须大于0')
  if (options.manual && !text(input.product))
    throw new Error('油品不能为空')
  if (options.manual && quantity <= 0)
    throw new Error('加油量必须大于0')

  return {
    ...input,
    code: text(input.code) || `FUEL-MANUAL-${randomUUID()}`,
    month: `${date.slice(0, 4)}${date.slice(5, 7)}`,
    date: date.slice(0, 16),
    plateNo,
    location,
    product: text(input.product),
    quantity: !options.manual && !text(input.quantity) ? '' : `${quantity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${quantityUnit}`,
    quantityUnit,
    amount: formatMoney(amount),
    driver: text(input.driver),
    status: text(input.status) || (options.manual ? '已录入' : '已导入'),
    ...(options.manual ? { source: 'manual' } : {}),
  }
}

function normalizeImportRows(value: unknown) {
  if (!Array.isArray(value) || !value.length)
    throw new Error('没有可导入的加油记录')
  if (value.length > 5000)
    throw new Error('单次最多导入5000条加油记录')
  const rows = value.map(item => normalizeTransportFuelRecord(item))
  const codes = new Set<string>()
  rows.forEach((record) => {
    if (codes.has(record.code))
      throw new Error(`加油记录 ${record.code} 在本批次重复`)
    codes.add(record.code)
  })
  return rows
}

function mysqlRecordParams(record: TransportFuelRecord) {
  const date = text(record.date)
  return [
    record.code,
    JSON.stringify(record),
    record.code,
    Number(date.slice(0, 4)) || null,
    Number(date.slice(5, 7)) || null,
    date.length <= 16 ? `${date}:00` : date,
    text(record.plateNo),
    text(record.location),
    text(record.product),
    number(record.quantity),
    number(record.amount),
    text(record.driver),
  ]
}

async function assertMysqlRowsAreNew(connection: mysql.PoolConnection, rows: TransportFuelRecord[]) {
  const codes = rows.map(row => row.code)
  const [existing] = await connection.query<mysql.RowDataPacket[]>(`
    SELECT code FROM transport_fuel_record
    WHERE deleted_at IS NULL AND code IN (${codes.map(() => '?').join(',')})
    LIMIT 1
  `, codes)
  if (existing.length)
    throw new Error(`加油记录 ${String(existing[0].code)} 已存在，禁止重复导入`)
}

async function persistMysqlRows(connection: mysql.PoolConnection, rows: TransportFuelRecord[]) {
  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400)
    const placeholders = chunk.map(() => '(?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)').join(',')
    await connection.query(`
      INSERT INTO transport_fuel_record (id, record_json, code, financial_year, financial_month, fuel_time, plate_no, location, product, quantity, amount, driver_name, created_at, updated_at, deleted_at)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), fuel_time=VALUES(fuel_time), plate_no=VALUES(plate_no), location=VALUES(location), product=VALUES(product), quantity=VALUES(quantity), amount=VALUES(amount), driver_name=VALUES(driver_name), updated_at=NOW(), deleted_at=NULL
    `, chunk.flatMap(mysqlRecordParams))
  }
}

async function saveRows(rows: TransportFuelRecord[]) {
  const db = getMysqlPool()
  if (db) {
    await ensureTransportOperationSchema(db)
    await withMysqlTransaction(db, async (connection) => {
      await assertMysqlRowsAreNew(connection, rows)
      await persistMysqlRows(connection, rows)
    })
    invalidateTransportOperationCache()
    return
  }
  if (isDatabaseRequired())
    throw new Error('数据库为必需配置，加油数据禁止写入本地 JSON')
  const dataset = await transportOperationStore.getDataset()
  const existingCodes = new Set((dataset.fuels as TransportFuelRecord[]).map(row => text(row.code)))
  const duplicate = rows.find(row => existingCodes.has(row.code))
  if (duplicate)
    throw new Error(`加油记录 ${duplicate.code} 已存在，禁止重复导入`)
  await transportOperationStore.replaceDataset({ ...dataset, fuels: [...rows, ...dataset.fuels] })
}

export const transportFuelStore = {
  async importRows(value: unknown) {
    const rows = normalizeImportRows(value)
    await saveRows(rows)
    return { importedCount: rows.length }
  },

  async createRecord(value: unknown) {
    const record = normalizeTransportFuelRecord(value, { manual: true })
    await saveRows([record])
    return record
  },
}
