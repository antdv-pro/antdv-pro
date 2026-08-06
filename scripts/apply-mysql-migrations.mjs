import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import mysql from 'mysql2/promise'
import { loadProductionEnv, mysqlConnectionOptions, requiredMysqlEnv } from './mysql-env.mjs'

const root = process.cwd()
const initDir = path.join(root, 'deploy/mysql/init')
const migrationsDir = path.join(root, 'deploy/mysql/migrations')
loadProductionEnv(root)

async function listSqlFiles(dir) {
  try {
    const files = await readdir(dir)
    return files.filter(file => file.endsWith('.sql')).sort().map(file => path.join(dir, file))
  }
  catch (error) {
    if (error?.code === 'ENOENT')
      return []
    throw error
  }
}

async function runSqlFile(connection, file) {
  const sql = await readFile(file, 'utf8')
  if (!sql.trim())
    return
  await connection.query(sql)
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function hasMigration(connection, filename) {
  const [rows] = await connection.query('SELECT id FROM schema_migrations WHERE filename = ? LIMIT 1', [filename])
  return rows.length > 0
}

async function markMigration(connection, filename) {
  await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename])
}

async function main() {
  const dbName = requiredMysqlEnv('DB_NAME')
  const connection = await mysql.createConnection({
    ...mysqlConnectionOptions({ database: undefined, multipleStatements: true }),
  })

  try {
    for (const file of await listSqlFiles(initDir)) {
      console.log(`[mysql:init] ${path.basename(file)}`)
      await runSqlFile(connection, file)
    }

    await connection.query(`USE \`${dbName}\``)
    await ensureMigrationTable(connection)

    for (const file of await listSqlFiles(migrationsDir)) {
      const filename = path.basename(file)
      if (await hasMigration(connection, filename)) {
        console.log(`[mysql:migration:skip] ${filename}`)
        continue
      }

      console.log(`[mysql:migration] ${filename}`)
      await connection.beginTransaction()
      try {
        await runSqlFile(connection, file)
        await markMigration(connection, filename)
        await connection.commit()
      }
      catch (error) {
        await connection.rollback()
        throw error
      }
    }

    console.log('[mysql] migrations completed')
  }
  finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('[mysql] migration failed')
  console.error(error)
  process.exit(1)
})
