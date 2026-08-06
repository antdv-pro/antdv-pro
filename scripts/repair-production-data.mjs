import mysql from 'mysql2/promise'
import { loadProductionEnv, mysqlConnectionOptions, requiredMysqlEnv } from './mysql-env.mjs'

const root = process.cwd()
loadProductionEnv(root)

const dbName = requiredMysqlEnv('DB_NAME')
const writeEnabled = process.env.REPAIR_PRODUCTION_DATA_CONFIRM === 'true'

const textTargets = [
  ['sys_company', 'id', ['code', 'name', 'status']],
  ['sys_department', 'id', ['code', 'name', 'status']],
  ['sys_post', 'id', ['code', 'name', 'status']],
  ['sys_role', 'id', ['code', 'name', 'remark', 'status']],
  ['sys_user', 'id', ['username', 'nickname', 'mobile', 'email', 'status']],
  ['sys_dict', 'id', ['type', 'type_name', 'label', 'value', 'remark', 'status']],
  ['approval_template', 'id', ['name']],
  ['approval_template_node', 'id', ['node_name', 'approver_type']],
  ['approval_instance', 'id', ['code', 'approval_type', 'business_module', 'business_type', 'business_no', 'title', 'applicant_name', 'dept_name', 'status', 'business_status', 'current_node_name']],
  ['approval_task', 'id', ['node_name', 'assignee_name', 'status', 'action', 'comment']],
  ['approval_log', 'id', ['action', 'operator_name', 'comment']],
  ['approval_cc', 'id', ['user_name']],
  ['approval_message', 'id', ['title', 'content']],
  ['approval_business_record', 'id', ['business_type', 'business_no', 'title', 'business_status', 'approval_status']],
  ['office_vehicle', 'id', ['plate_no', 'vehicle_type', 'brand_model', 'department_name', 'owner_name', 'default_driver_name', 'status', 'photo_url', 'remark']],
  ['office_vehicle_expense', 'id', ['plate_no', 'expense_type', 'handler_name', 'department_name', 'payment_method', 'invoice_no', 'attachment_name', 'attachment_url', 'approval_status', 'remark']],
  ['office_vehicle_license', 'id', ['plate_no', 'license_type', 'license_no', 'issuing_authority', 'attachment_name', 'attachment_url', 'status', 'remark']],
  ['office_vehicle_insurance', 'id', ['plate_no', 'insurance_type', 'policy_no', 'insurer', 'attachment_name', 'status', 'remark']],
  ['office_vehicle_reminder', 'id', ['plate_no', 'reminder_type', 'target_names', 'status', 'handle_remark', 'source_type']],
  ['office_vehicle_operation_log', 'id', ['module', 'action', 'operator_name', 'content']],
]

const jsonTargets = [
  ['transport_order', 'id', ['record_json']],
  ['trade_order', 'code', ['order_json']],
  ['hotel_revenue', 'id', ['revenue_json']],
  ['oa_dashboard_record', 'id', ['record_json']],
  ['oa_org_record', 'id', ['record_json']],
  ['oa_vehicle_record', 'id', ['record_json']],
  ['gps_provider_config', 'id', ['record_json']],
  ['gps_transport_vehicle', 'vehicle_id', ['record_json']],
  ['gps_device', 'device_id', ['record_json']],
  ['gps_vehicle_device_bind', 'id', ['record_json']],
  ['gps_location_latest', 'id', ['record_json']],
  ['gps_track_point', 'id', ['record_json']],
  ['gps_alarm', 'id', ['record_json']],
  ['gps_geofence', 'id', ['record_json']],
]

const healthTables = [
  'sys_user',
  'sys_role',
  'sys_menu',
  'approval_template',
  'approval_instance',
  'transport_order',
  'transport_fuel_record',
  'transport_etc_record',
  'transport_driver_payroll',
  'transport_maintenance_order',
  'transport_vehicle_loan',
  'trade_order',
  'hotel_revenue',
  'gps_transport_vehicle',
  'gps_device',
  'gps_location_latest',
  'gps_track_point',
  'gps_alarm',
  'office_vehicle',
  'office_vehicle_expense',
  'office_vehicle_license',
  'office_vehicle_insurance',
  'office_vehicle_reminder',
]

function looksMojibake(value) {
  return typeof value === 'string' && /[ÃÂ�]|(?:[èéçåäöü][\s\S]{0,5}[\u0080-\u00bf])/.test(value)
}

const windows1252Bytes = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
}

function repairMojibake(value) {
  if (!looksMojibake(value))
    return value

  const bytes = []
  for (const char of value) {
    const byte = windows1252Bytes[char] ?? char.codePointAt(0)
    if (byte == null || byte > 0xFF)
      return value
    bytes.push(byte)
  }

  const repaired = Buffer.from(bytes).toString('utf8')
  return repaired.includes('�') ? value : repaired
}

async function tableExists(connection, table) {
  const [rows] = await connection.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
    [table],
  )
  return rows.length > 0
}

async function getExistingColumns(connection, table, columns) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (${columns.map(() => '?').join(',')})`,
    [table, ...columns],
  )
  return new Set(rows.map(row => row.COLUMN_NAME))
}

async function convertSchemaToUtf8mb4(connection) {
  await connection.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)

  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  )

  for (const row of tables)
    await connection.query(`ALTER TABLE \`${row.TABLE_NAME}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)

  return tables.length
}

async function repairTextColumns(connection, targets) {
  const changes = []

  for (const [table, keyColumn, columns] of targets) {
    if (!(await tableExists(connection, table)))
      continue

    const columnSet = await getExistingColumns(connection, table, [keyColumn, ...columns])
    if (!columnSet.has(keyColumn))
      continue

    const existingColumns = columns.filter(column => columnSet.has(column))
    if (!existingColumns.length)
      continue

    const [rows] = await connection.query(
      `SELECT \`${keyColumn}\`, ${existingColumns.map(column => `\`${column}\``).join(', ')} FROM \`${table}\``,
    )

    for (const row of rows) {
      const updates = {}
      for (const column of existingColumns) {
        const repaired = repairMojibake(row[column])
        if (repaired !== row[column])
          updates[column] = repaired
      }

      const updateColumns = Object.keys(updates)
      if (!updateColumns.length)
        continue

      changes.push({
        table,
        key: row[keyColumn],
        columns: updateColumns,
        sample: updateColumns.map(column => `${column}: ${row[column]} -> ${updates[column]}`).join('; '),
      })

      if (writeEnabled) {
        await connection.execute(
          `UPDATE \`${table}\` SET ${updateColumns.map(column => `\`${column}\` = ?`).join(', ')} WHERE \`${keyColumn}\` = ?`,
          [...updateColumns.map(column => updates[column]), row[keyColumn]],
        )
      }
    }
  }

  return changes
}

async function countRows(connection, table) {
  if (!(await tableExists(connection, table)))
    return null
  const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
  return Number(rows[0]?.count || 0)
}

async function printHealth(connection) {
  const rows = []
  for (const table of healthTables)
    rows.push({ table, rows: await countRows(connection, table) })
  console.table(rows)
}

async function main() {
  const connection = await mysql.createConnection(mysqlConnectionOptions())

  try {
    const textChanges = await repairTextColumns(connection, textTargets)
    const jsonChanges = await repairTextColumns(connection, jsonTargets)
    const changes = [...textChanges, ...jsonChanges]

    if (changes.length) {
      console.table(changes.slice(0, 50))
      if (changes.length > 50)
        console.log(`[mysql:repair] 仅显示前 50 条，共 ${changes.length} 条待修复`)
    }
    else {
      console.log('[mysql:repair] 未发现典型中文乱码字段')
    }

    if (writeEnabled) {
      const convertedTables = await convertSchemaToUtf8mb4(connection)
      console.log(`[mysql:repair] 已转换数据库和 ${convertedTables} 张表为 utf8mb4`)
      console.log(`[mysql:repair] 已修复乱码字段 ${changes.length} 条`)
    }
    else {
      console.log('[mysql:repair] 预览完成，未写库。确认修复请执行: REPAIR_PRODUCTION_DATA_CONFIRM=true pnpm repair:data:mysql')
    }

    await printHealth(connection)
  }
  finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('[mysql:repair] failed')
  console.error(error)
  process.exit(1)
})
