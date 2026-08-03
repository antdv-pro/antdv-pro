import type mysql from 'mysql2/promise'
import { normalizePagination, paginateRows } from '../services/pagination'
import { resolveRuntimeJsonDataFile } from './data-paths'
import { readJsonFile, writeJsonFile } from './json-store'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'

export interface HotelRevenueRecord {
  id: string
  date: string
  [key: string]: any
}

const dataFile = resolveRuntimeJsonDataFile('hotel-revenue-records.json')

function normalizeRows(rows: unknown): HotelRevenueRecord[] {
  return Array.isArray(rows)
    ? rows
        .filter((row): row is HotelRevenueRecord => !!row && typeof row === 'object' && !!(row as any).id && !!(row as any).date)
        .map((row) => {
          // These legacy booking dimensions are intentionally no longer part of hotel revenue.
          const current = { ...(row as any) }
          delete current.roomOrOrderNo
          delete current.roomType
          delete current.channel
          return current
        })
    : []
}

export const hotelRevenueStore = {
  async list(date?: string) {
    const db = getMysqlPool()
    if (db) {
      await ensureHotelRevenueSchema(db)
      const [rows] = await db.query<mysql.RowDataPacket[]>(
        `
          SELECT revenue_json
          FROM hotel_revenue
          WHERE deleted_at IS NULL
          ${date ? 'AND revenue_date = ?' : ''}
          ORDER BY revenue_date DESC, updated_at DESC
        `,
        date ? [date] : [],
      )
      return normalizeRows(rows.map((row: any) => typeof row.revenue_json === 'string' ? JSON.parse(row.revenue_json) : row.revenue_json))
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，酒店营收禁止读取本地 JSON')
    const rows = normalizeRows(readJsonFile<HotelRevenueRecord[]>(dataFile, []))
    return date ? rows.filter(row => row.date === date) : rows
  },

  async listPage(date: string | undefined, current: unknown, pageSize: unknown) {
    const page = normalizePagination(current, pageSize)
    const db = getMysqlPool()
    if (db) {
      await ensureHotelRevenueSchema(db)
      const where = `deleted_at IS NULL${date ? ' AND revenue_date = ?' : ''}`
      const params = date ? [date] : []
      const [[countRows], [rows]] = await Promise.all([
        db.query<Array<mysql.RowDataPacket & { total: number }>>(`SELECT COUNT(*) AS total FROM hotel_revenue WHERE ${where}`, params),
        db.query<mysql.RowDataPacket[]>(`SELECT revenue_json FROM hotel_revenue WHERE ${where} ORDER BY revenue_date DESC, updated_at DESC LIMIT ? OFFSET ?`, [...params, page.pageSize, page.offset]),
      ])
      return {
        records: normalizeRows(rows.map((row: any) => typeof row.revenue_json === 'string' ? JSON.parse(row.revenue_json) : row.revenue_json)),
        total: Number(countRows[0]?.total || 0),
        current: page.current,
        pageSize: page.pageSize,
      }
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，酒店营收禁止读取本地 JSON')
    const rows = normalizeRows(readJsonFile<HotelRevenueRecord[]>(dataFile, []))
    return paginateRows(date ? rows.filter(row => row.date === date) : rows, page.current, page.pageSize)
  },

  async replaceByDate(date: string, rows: unknown) {
    const nextRows = normalizeRows(rows).map(row => ({ ...row, date }))
    const db = getMysqlPool()
    if (db) {
      await ensureHotelRevenueSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        await connection.execute('UPDATE hotel_revenue SET deleted_at = NOW() WHERE revenue_date = ? AND deleted_at IS NULL', [date])
        for (const row of nextRows) {
          await connection.execute(`
          INSERT INTO hotel_revenue (id, revenue_date, revenue_json, created_at, updated_at, deleted_at)
          VALUES (?, ?, CAST(? AS JSON), NOW(), NOW(), NULL)
          ON DUPLICATE KEY UPDATE revenue_date = VALUES(revenue_date), revenue_json = VALUES(revenue_json), updated_at = NOW(), deleted_at = NULL
        `, [row.id, date, JSON.stringify(row)])
        }
      })
      return nextRows
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，酒店营收禁止写入本地 JSON')
    const current = await this.list()
    const data = [...nextRows, ...current.filter(row => row.date !== date)]
    writeJsonFile(dataFile, data)
    return nextRows
  },

  async applyChanges(date: string, input: { upsert?: unknown, deleteIds?: unknown }) {
    const upsert = normalizeRows(input.upsert).map(row => ({ ...row, date }))
    const deleteIds = Array.isArray(input.deleteIds)
      ? [...new Set(input.deleteIds.map(String).map(value => value.trim()).filter(Boolean))]
      : []
    const db = getMysqlPool()
    if (db) {
      await ensureHotelRevenueSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        for (const id of deleteIds) {
          await connection.execute('UPDATE hotel_revenue SET deleted_at = NOW() WHERE id = ? AND revenue_date = ? AND deleted_at IS NULL', [id, date])
          await connection.execute('INSERT INTO hotel_revenue_revision (revenue_id, action, snapshot_json, created_at) VALUES (?, ?, NULL, NOW())', [id, 'delete'])
        }
        for (const row of upsert) {
          await connection.execute(`
            INSERT INTO hotel_revenue (id, revenue_date, revenue_json, revenue_type, category, amount, payment_method, handler, created_at, updated_at, deleted_at)
            VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
            ON DUPLICATE KEY UPDATE revenue_date = VALUES(revenue_date), revenue_json = VALUES(revenue_json), revenue_type = VALUES(revenue_type), category = VALUES(category), amount = VALUES(amount), payment_method = VALUES(payment_method), handler = VALUES(handler), updated_at = NOW(), deleted_at = NULL
          `, [row.id, date, JSON.stringify(row), row.type || null, row.category || null, Number(row.amount || 0), row.paymentMethod || null, row.handler || null])
          await connection.execute('INSERT INTO hotel_revenue_revision (revenue_id, action, snapshot_json, created_at) VALUES (?, ?, CAST(? AS JSON), NOW())', [row.id, 'upsert', JSON.stringify(row)])
        }
      })
      return this.list(date)
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，酒店营收禁止写入本地 JSON')
    const current = await this.list()
    const deleted = new Set(deleteIds)
    const byId = new Map(current.filter(row => row.date !== date || !deleted.has(row.id)).map(row => [row.id, row]))
    upsert.forEach(row => byId.set(row.id, row))
    writeJsonFile(dataFile, [...byId.values()])
    return this.list(date)
  },
}

async function ensureHotelRevenueSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hotel_revenue (
      id VARCHAR(64) PRIMARY KEY,
      revenue_date DATE NOT NULL,
      revenue_json JSON NOT NULL,
      revenue_type VARCHAR(32) NULL,
      category VARCHAR(64) NULL,
      amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(64) NULL,
      handler VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_hotel_revenue_date (revenue_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureColumn(db, 'hotel_revenue', 'revenue_type', 'VARCHAR(32) NULL')
  await ensureColumn(db, 'hotel_revenue', 'category', 'VARCHAR(64) NULL')
  await ensureColumn(db, 'hotel_revenue', 'amount', 'DECIMAL(18,2) NOT NULL DEFAULT 0')
  await ensureColumn(db, 'hotel_revenue', 'payment_method', 'VARCHAR(64) NULL')
  await ensureColumn(db, 'hotel_revenue', 'handler', 'VARCHAR(128) NULL')
  await db.query(`
    CREATE TABLE IF NOT EXISTS hotel_revenue_revision (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      revenue_id VARCHAR(64) NOT NULL,
      action VARCHAR(32) NOT NULL,
      snapshot_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_hotel_revenue_revision_id (revenue_id, created_at)
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
