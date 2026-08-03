import type mysql from 'mysql2/promise'
import { resolveRuntimeJsonDataFile } from './data-paths'
import { readJsonFile, writeJsonFile } from './json-store'
import { getMysqlPool, isDatabaseRequired } from './mysql'

export interface BillReconciliationArchive {
  id: string
  [key: string]: any
}

const dataFile = resolveRuntimeJsonDataFile('bill-reconciliation-archives.json')

function normalizeArchives(rows: unknown): BillReconciliationArchive[] {
  return Array.isArray(rows)
    ? rows.filter((row): row is BillReconciliationArchive => !!row && typeof row === 'object' && !!(row as any).id)
    : []
}

export const billReconciliationStore = {
  async list() {
    const db = getMysqlPool()
    if (db) {
      await ensureBillArchiveSchema(db)
      const [rows] = await db.query<mysql.RowDataPacket[]>(`
        SELECT archive_json
        FROM bill_reconciliation_archive
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC
      `)
      return normalizeArchives(rows.map((row: any) => typeof row.archive_json === 'string' ? JSON.parse(row.archive_json) : row.archive_json))
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，对账归档禁止读取本地 JSON')
    return normalizeArchives(readJsonFile<BillReconciliationArchive[]>(dataFile, []))
  },

  async save(record: BillReconciliationArchive) {
    const db = getMysqlPool()
    if (db) {
      await ensureBillArchiveSchema(db)
      await db.execute(`
        INSERT INTO bill_reconciliation_archive (id, archive_json, created_at, updated_at, deleted_at)
        VALUES (?, CAST(? AS JSON), NOW(), NOW(), NULL)
        ON DUPLICATE KEY UPDATE archive_json = VALUES(archive_json), updated_at = NOW(), deleted_at = NULL
      `, [record.id, JSON.stringify(record)])
      return this.list()
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，对账归档禁止写入本地 JSON')
    const rows = (await this.list()).filter(item => item.id !== record.id)
    const data = [record, ...rows]
    writeJsonFile(dataFile, data)
    return data
  },
}

async function ensureBillArchiveSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bill_reconciliation_archive (
      id VARCHAR(64) PRIMARY KEY,
      archive_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_bill_reconciliation_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}
