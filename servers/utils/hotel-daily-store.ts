import type mysql from 'mysql2/promise'
import { resolveRuntimeJsonDataFile } from './data-paths'
import { readJsonFile, writeJsonFile } from './json-store'
import { getMysqlPool, isDatabaseRequired } from './mysql'

export interface HotelDailyRecord {
  date: string
  totalRooms: number
  occupiedRooms: number
  remark: string
  updatedAt?: string
}

const dataFile = resolveRuntimeJsonDataFile('hotel-daily-records.json')

function normalizeScope(companyId: unknown, deptId?: unknown, userId?: unknown) {
  return {
    companyId: String(companyId || 'company-main'),
    deptId: String(deptId || 'hotel'),
    ownerUserId: userId == null ? null : String(userId),
    createdBy: userId == null ? null : String(userId),
  }
}

export function normalizeHotelDailyRecord(value: unknown): HotelDailyRecord | null {
  if (!value || typeof value !== 'object')
    return null
  const row = value as Record<string, unknown>
  const date = String(row.date || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return null
  const occupiedRooms = Math.min(100, Math.max(0, Math.trunc(Number(row.occupiedRooms) || 0)))
  return {
    date,
    totalRooms: 100,
    occupiedRooms,
    remark: String(row.remark || '').trim().slice(0, 500),
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  }
}

function normalizeRows(rows: unknown) {
  return Array.isArray(rows)
    ? rows.map(normalizeHotelDailyRecord).filter((row): row is HotelDailyRecord => !!row)
    : []
}

function formatDatabaseDate(value: unknown) {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return String(value || '').slice(0, 10)
}

export const hotelDailyStore = {
  async list(companyId?: unknown, deptId?: unknown) {
    const scope = normalizeScope(companyId, deptId)
    const db = getMysqlPool()
    if (db) {
      await ensureHotelDailySchema(db)
      const [rows] = await db.query<mysql.RowDataPacket[]>(`
        SELECT business_date, total_rooms, occupied_rooms, remark, updated_at
        FROM hotel_daily_operation
        WHERE company_id = ?
        ORDER BY business_date DESC
      `, [scope.companyId])
      return rows.map((row: any) => ({
        date: formatDatabaseDate(row.business_date),
        totalRooms: Number(row.total_rooms),
        occupiedRooms: Number(row.occupied_rooms),
        remark: String(row.remark || ''),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      }))
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，酒店房态禁止读取本地 JSON')
    return normalizeRows(readJsonFile<HotelDailyRecord[]>(dataFile, []))
      .sort((a, b) => b.date.localeCompare(a.date))
  },

  async get(date: string, companyId?: unknown, deptId?: unknown) {
    const rows = await this.list(companyId, deptId)
    return rows.find(row => row.date === date) || null
  },

  async save(input: unknown, companyId?: unknown, deptId?: unknown, userId?: unknown) {
    const scope = normalizeScope(companyId, deptId, userId)

    const db = getMysqlPool()
    if (db) {
      await ensureHotelDailySchema(db)
      return upsertHotelDailyRecord(db, input, scope)
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，酒店房态禁止写入本地 JSON')
    const row = normalizeHotelDailyRecord(input)
    if (!row)
      throw new Error('营业日期格式不正确')
    const current = await this.list()
    const saved = { ...row, updatedAt: new Date().toISOString() }
    writeJsonFile(dataFile, [saved, ...current.filter(item => item.date !== row.date)])
    return saved
  },
}

export async function upsertHotelDailyRecord(connection: { execute: (sql: string, values: unknown[]) => Promise<unknown> }, input: unknown, companyId?: unknown, deptId?: unknown, userId?: unknown) {
  const row = normalizeHotelDailyRecord(input)
  if (!row)
    throw new Error('营业日期格式不正确')
  const scope = typeof companyId === 'object' && companyId !== null
    ? companyId as ReturnType<typeof normalizeScope>
    : normalizeScope(companyId, deptId, userId)
  await connection.execute(`
    INSERT INTO hotel_daily_operation (company_id, dept_id, business_date, total_rooms, occupied_rooms, remark, owner_user_id, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 100, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE total_rooms = 100, occupied_rooms = VALUES(occupied_rooms), remark = VALUES(remark), owner_user_id = VALUES(owner_user_id), updated_at = NOW()
  `, [scope.companyId, scope.deptId, row.date, row.occupiedRooms, row.remark, scope.ownerUserId, scope.createdBy])
  return { ...row, updatedAt: new Date().toISOString() }
}

export async function ensureHotelDailySchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hotel_daily_operation (
      company_id BIGINT NOT NULL DEFAULT 1,
      business_date DATE NOT NULL,
      total_rooms SMALLINT UNSIGNED NOT NULL DEFAULT 100,
      occupied_rooms SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      remark VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (company_id, business_date),
      CONSTRAINT chk_hotel_daily_total_rooms CHECK (total_rooms = 100),
      CONSTRAINT chk_hotel_daily_occupied_rooms CHECK (occupied_rooms <= total_rooms)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureColumn(db, 'hotel_daily_operation', 'company_id', 'VARCHAR(64) NOT NULL DEFAULT \'company-main\'')
  await ensureColumn(db, 'hotel_daily_operation', 'dept_id', 'VARCHAR(64) NOT NULL DEFAULT \'hotel\'')
  await ensureColumn(db, 'hotel_daily_operation', 'owner_user_id', 'VARCHAR(64) NULL')
  await ensureColumn(db, 'hotel_daily_operation', 'created_by', 'VARCHAR(64) NULL')
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
