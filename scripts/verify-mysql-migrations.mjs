import { spawnSync } from 'node:child_process'
import process from 'node:process'
import mysql from 'mysql2/promise'
import { loadProductionEnv, mysqlConnectionOptions, requiredMysqlEnv } from './mysql-env.mjs'

loadProductionEnv(process.cwd())

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

async function tableExists(connection, dbName, tableName) {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
    [dbName, tableName],
  )
  return rows.length > 0
}

async function countRows(connection, sql, params = []) {
  const [rows] = await connection.query(sql, params)
  return Number(rows[0]?.count || 0)
}

async function verifyTables(connection, dbName) {
  const tables = [
    'sys_user',
    'sys_role',
    'sys_menu',
    'sys_dict',
    'approval_template',
    'approval_instance',
    'approval_business_record',
    'approval_generic_business_record',
    'oa_dashboard_record',
    'oa_org_record',
    'oa_vehicle_record',
    'hr_employee',
    'hr_salary_template',
    'hr_salary_record',
    'finance_receivable_payable',
    'finance_cash_flow',
    'transport_order',
    'transport_fuel_record',
    'transport_etc_record',
    'transport_maintenance_order',
    'transport_vehicle_loan',
    'transport_driver_payroll',
    'gps_provider_config',
    'gps_location_latest',
    'gps_geofence',
    'regulatory_fee',
    'trade_order',
    'hotel_revenue',
    'hotel_daily_operation',
    'bill_reconciliation_archive',
  ]

  for (const table of tables)
    assert(await tableExists(connection, dbName, table), `缺少数据表: ${table}`)
}

async function verifySeeds(connection) {
  assert(await countRows(connection, 'SELECT COUNT(*) AS count FROM sys_role WHERE code = ?', ['ADMIN']) > 0, '缺少 ADMIN 角色')
  assert(await countRows(connection, 'SELECT COUNT(*) AS count FROM sys_menu') > 0, '缺少基础菜单数据')
  assert(await countRows(connection, 'SELECT COUNT(*) AS count FROM sys_dict') > 0, '缺少系统字典数据')
}

async function verifyBusinessTablesQueryable(connection) {
  const tables = [
    'approval_instance',
    'oa_dashboard_record',
    'hr_salary_record',
    'finance_cash_flow',
    'transport_order',
    'gps_location_latest',
    'regulatory_fee',
    'trade_order',
    'hotel_revenue',
    'hotel_daily_operation',
    'bill_reconciliation_archive',
  ]

  for (const table of tables)
    await connection.query(`SELECT COUNT(*) AS count FROM ${table}`)
}

function runMigrations() {
  if (process.env.VERIFY_MYSQL_SKIP_MIGRATE === 'true')
    return

  const result = spawnSync(process.execPath, ['scripts/apply-mysql-migrations.mjs'], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0)
    throw new Error('MySQL 迁移执行失败，已停止验证')
}

async function main() {
  const dbName = requiredMysqlEnv('DB_NAME')
  runMigrations()

  const connection = await mysql.createConnection(mysqlConnectionOptions({ database: dbName }))

  try {
    await verifyTables(connection, dbName)
    await verifySeeds(connection)
    await verifyBusinessTablesQueryable(connection)
    console.log('[mysql:verify] schema, seeds, and business table queries verified')
  }
  finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('[mysql:verify] verification failed')
  console.error(error)
  process.exit(1)
})
