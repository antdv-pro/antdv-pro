import mysql from 'mysql2/promise'
import { runtimeConfig } from './runtime-config'

let pool: mysql.Pool | undefined

function canUseMysql() {
  return runtimeConfig.database.client === 'mysql'
    && Boolean(runtimeConfig.database.host)
    && Boolean(runtimeConfig.database.user)
    && Boolean(runtimeConfig.database.name)
}

export function isDatabaseRequired() {
  return runtimeConfig.database.required
}

export function getMysqlPool() {
  if (!canUseMysql()) {
    if (runtimeConfig.database.required)
      throw new Error('数据库未配置完整，当前环境禁止回退到本地 JSON 或内存数据')
    return undefined
  }

  if (!pool) {
    pool = mysql.createPool({
      host: runtimeConfig.database.host,
      port: runtimeConfig.database.port,
      user: runtimeConfig.database.user,
      password: runtimeConfig.database.password,
      database: runtimeConfig.database.name,
      connectionLimit: 10,
      connectTimeout: runtimeConfig.database.connectTimeoutMs,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      charset: 'utf8mb4',
      namedPlaceholders: true,
    })
    pool.on('connection', (connection) => {
      connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci')
    })
  }

  return pool
}

export async function checkMysqlConnection() {
  const db = getMysqlPool()
  if (!db)
    return { configured: false, ready: !runtimeConfig.database.required }

  try {
    await db.query('SELECT 1')
    return { configured: true, ready: true }
  }
  catch {
    return { configured: true, ready: false }
  }
}

export async function withMysql<T>(handler: (db: mysql.Pool) => Promise<T>) {
  const db = getMysqlPool()
  if (!db)
    return undefined

  return handler(db)
}

export async function requireMysql<T>(handler: (db: mysql.Pool) => Promise<T>) {
  const db = getMysqlPool()
  if (!db)
    throw new Error('数据库未配置完整，无法执行真实数据操作')

  return handler(db)
}

export async function withMysqlTransaction<T>(db: mysql.Pool, handler: (connection: mysql.PoolConnection) => Promise<T>) {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const result = await handler(connection)
    await connection.commit()
    return result
  }
  catch (error) {
    await connection.rollback()
    throw error
  }
  finally {
    connection.release()
  }
}
