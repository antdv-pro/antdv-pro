import mysql from 'mysql2/promise'
import { assertWriteEnabled, loadProductionEnv, mysqlConnectionOptions } from './mysql-env.mjs'

const root = process.cwd()
loadProductionEnv(root)

const businessTables = [
  'office_vehicle_operation_log',
  'office_vehicle_reminder',
  'office_vehicle_insurance',
  'office_vehicle_license',
  'office_vehicle_expense',
  'office_vehicle',
  'regulatory_fee',
  'transport_vehicle_loan_payment',
  'transport_vehicle_loan',
  'transport_maintenance_order',
  'transport_driver_payroll',
  'transport_etc_record',
  'transport_fuel_record',
  'transport_order',
  'transport_operation_record',
  'oa_dashboard_record',
  'oa_vehicle_record',
  'oa_org_record',
  'finance_cash_balance',
  'finance_cash_flow',
  'finance_receivable_payable',
  'hr_salary_record',
  'hr_salary_template',
  'hr_employee',
  'trade_order',
  'hotel_revenue',
  'bill_reconciliation_archive',
  'approval_message',
  'approval_cc',
  'approval_log',
  'approval_task',
  'approval_node',
  'approval_business_record',
  'approval_generic_business_record',
  'approval_cash_flow',
  'approval_cash_account',
  'approval_leave_balance',
  'approval_instance',
  'approval_state',
  'gps_operation_log',
  'gps_sync_log',
  'gps_geofence_vehicle',
  'gps_geofence',
  'gps_alarm',
  'gps_track_point',
  'gps_location_latest',
  'gps_vehicle_device_bind',
  'gps_device',
  'gps_transport_vehicle',
  'gps_provider_config',
]

const legacyStateTables = [
  'oa_module_state',
  'gps_state',
]

async function tableExists(connection, table) {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
    [table],
  )
  return rows.length > 0
}

async function hasColumn(connection, table, column) {
  const [rows] = await connection.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column],
  )
  return rows.length > 0
}

async function countRows(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
  return Number(rows[0]?.count || 0)
}

async function main() {
  const connection = await mysql.createConnection(mysqlConnectionOptions())
  const targets = []

  try {
    for (const table of [...businessTables, ...legacyStateTables]) {
      if (!(await tableExists(connection, table)))
        continue
      targets.push({
        table,
        count: await countRows(connection, table),
        softDelete: await hasColumn(connection, table, 'deleted_at'),
      })
    }

    console.table(targets)
    assertWriteEnabled('CLEAN_FAKE_DATA_CONFIRM', '清理旧业务/假数据')

    await connection.beginTransaction()
    try {
      for (const target of targets) {
        if (target.count === 0)
          continue
        if (target.softDelete && !legacyStateTables.includes(target.table))
          await connection.execute(`UPDATE \`${target.table}\` SET deleted_at = NOW() WHERE deleted_at IS NULL`)
        else
          await connection.execute(`DELETE FROM \`${target.table}\``)
        console.log(`[mysql:clean] ${target.table}`)
      }
      await connection.commit()
      console.log('[mysql:clean] completed')
    }
    catch (error) {
      await connection.rollback()
      throw error
    }
  }
  finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('[mysql:clean] failed')
  console.error(error)
  process.exit(1)
})
