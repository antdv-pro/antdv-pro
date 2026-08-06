import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { assertWriteEnabled, loadProductionEnv, mysqlConnectionOptions } from './mysql-env.mjs'

loadProductionEnv()

const sourcePath = process.env.TRANSPORT_ORDERS_HISTORY_FILE
  || path.resolve(process.cwd(), '../transport_orders_all.json')
const rows = JSON.parse(await fs.readFile(sourcePath, 'utf8'))

if (!Array.isArray(rows))
  throw new TypeError('历史运输订单源文件必须是 JSON 数组')

function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function dateOnly(value) {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '1970-01-01'
}

function monthParts(value, fallbackDate) {
  const match = String(value || fallbackDate || '').match(/(\d{4})\D?(\d{1,2})/)
  return match ? [Number(match[1]), Number(match[2])] : [null, null]
}

function mapOrder(row, index) {
  const sourceId = row.orderId ?? index + 1
  const originalCode = String(row.orderNumber || '').trim()
  const code = originalCode || `LS-${sourceId}`
  const shipDate = dateOnly(row.outTime || row.createTime)
  const [year, month] = monthParts(row.moneyMonth, shipDate)
  const record = {
    id: `history-${sourceId}`,
    code,
    sourceOrderId: row.orderId ?? null,
    originalOrderNumber: row.orderNumber ?? '',
    shipDate,
    financeMonth: year && month ? `${year}-${String(month).padStart(2, '0')}` : '',
    plateNo: row.numberplate || '',
    driver: row.driverName || '',
    customer: row.companyName || '',
    routeLine: row.detailName || '',
    loadingAddress: row.outAddress || '',
    unloadingAddress: row.inAddress || '',
    orderType: row.orderType || '',
    cargoName: row.goodsName || '',
    sentWeight: number(row.goodsWeight),
    receivedWeight: number(row.putWeight),
    distance: number(row.haulDistance ?? row.distance),
    freightPrice: number(row.goodsMoney),
    freightTotal: number(row.goodsAll),
    taxRate: number(row.taxRate),
    taxedFreight: number(row.taxMoney),
    actualFuelAmount: number(row.waterAll),
    actualFuelVolume: number(row.waterNumber),
    travelFee: number(row.feeMoney),
    etcFee: number(row.tollMoney),
    status: row.orderStatus || '待审核',
    remark: row.orderRemark || row.remark || '',
    legacy: row,
  }
  return { record, year, month }
}

const mapped = rows.map(mapOrder)
const codeCounts = new Map()
for (const item of mapped)
  codeCounts.set(item.record.code, (codeCounts.get(item.record.code) || 0) + 1)
for (const item of mapped) {
  if (codeCounts.get(item.record.code) > 1)
    item.record.code = `${item.record.code}-${item.record.sourceOrderId}`
}

console.log(JSON.stringify({ sourcePath, rows: mapped.length, duplicateCodesResolved: [...codeCounts.values()].filter(count => count > 1).length }))
assertWriteEnabled('IMPORT_TRANSPORT_ORDERS_CONFIRM', '导入历史运输订单')

const connection = await mysql.createConnection(mysqlConnectionOptions())
const backupDir = path.resolve(process.cwd(), 'storage/backups')
const backupPath = path.join(backupDir, `transport-orders-before-history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)

try {
  const [current] = await connection.query('SELECT record_json FROM transport_order WHERE deleted_at IS NULL ORDER BY ship_date, code')
  await fs.mkdir(backupDir, { recursive: true })
  await fs.writeFile(backupPath, `${JSON.stringify(current.map(row => row.record_json), null, 2)}\n`)

  await connection.beginTransaction()
  await connection.execute('UPDATE transport_order SET deleted_at = NOW() WHERE deleted_at IS NULL')
  for (const { record, year, month } of mapped) {
    await connection.execute(`
      INSERT INTO transport_order (
        id, record_json, code, financial_year, financial_month, ship_date, customer_name, plate_no,
        driver_name, route_name, loading_address, unloading_address, order_type, cargo_name,
        sent_weight, received_weight, distance_km, pricing_formula, freight_price, freight_total,
        tax_rate, taxed_freight, actual_fuel_quantity, actual_fuel_amount, etc_fee,
        transport_status, remark, created_at, updated_at, deleted_at
      ) VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), code=VALUES(code), financial_year=VALUES(financial_year),
        financial_month=VALUES(financial_month), ship_date=VALUES(ship_date), customer_name=VALUES(customer_name),
        plate_no=VALUES(plate_no), driver_name=VALUES(driver_name), route_name=VALUES(route_name),
        loading_address=VALUES(loading_address), unloading_address=VALUES(unloading_address), order_type=VALUES(order_type),
        cargo_name=VALUES(cargo_name), sent_weight=VALUES(sent_weight), received_weight=VALUES(received_weight),
        distance_km=VALUES(distance_km), freight_price=VALUES(freight_price), freight_total=VALUES(freight_total),
        tax_rate=VALUES(tax_rate), taxed_freight=VALUES(taxed_freight), actual_fuel_quantity=VALUES(actual_fuel_quantity),
        actual_fuel_amount=VALUES(actual_fuel_amount), etc_fee=VALUES(etc_fee), transport_status=VALUES(transport_status),
        remark=VALUES(remark), updated_at=NOW(), deleted_at=NULL
    `, [record.id, JSON.stringify(record), record.code, year, month, record.shipDate, record.customer, record.plateNo,
      record.driver, record.routeLine, record.loadingAddress, record.unloadingAddress, record.orderType, record.cargoName,
      record.sentWeight, record.receivedWeight, record.distance, '吨位×单价', record.freightPrice, record.freightTotal,
      record.taxRate / 100, record.taxedFreight, record.actualFuelVolume, record.actualFuelAmount, record.etcFee,
      record.status, record.remark])
  }
  const [[result]] = await connection.query('SELECT COUNT(*) AS count FROM transport_order WHERE deleted_at IS NULL')
  if (Number(result.count) !== mapped.length)
    throw new Error(`导入后数量不一致: 预期 ${mapped.length}，实际 ${result.count}`)
  await connection.commit()
  console.log(JSON.stringify({ imported: mapped.length, backupPath }))
}
catch (error) {
  await connection.rollback()
  throw error
}
finally {
  await connection.end()
}
