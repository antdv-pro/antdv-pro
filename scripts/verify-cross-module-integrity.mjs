import mysql from 'mysql2/promise'
import { computeBusinessOverview } from '../shared/business-overview.ts'
import { loadProductionEnv, mysqlConnectionOptions } from './mysql-env.mjs'

loadProductionEnv(process.cwd())

const failures = []
const warnings = []

function parseJson(value) {
  if (!value)
    return {}
  if (typeof value === 'object')
    return value
  try {
    return JSON.parse(value)
  }
  catch {
    return {}
  }
}

function number(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function plate(value) {
  return String(value ?? '').replace(/[\s·•.-]/g, '').toUpperCase()
}

function routeKey(value) {
  return String(value ?? '').trim().replace(/[\s·・,，/至到—–-]+/g, '').toLowerCase()
}

function dateKey(value) {
  if (value instanceof Date)
    return value.toISOString().slice(0, 10)
  return String(value ?? '').slice(0, 10)
}

function usablePlate(value) {
  return /^[\p{Script=Han}][A-Z][A-Z0-9]{5,6}$/u.test(plate(value))
}

function check(condition, message) {
  if (!condition)
    failures.push(message)
}

function warn(condition, message) {
  if (!condition)
    warnings.push(message)
}

async function rows(db, sql, params = []) {
  const [result] = await db.query(sql, params)
  return result
}

async function main() {
  const db = await mysql.createConnection(mysqlConnectionOptions())
  try {
    const [
      orders,
      baseData,
      gpsVehicles,
      gpsBinds,
      gpsDevices,
      approvals,
      approvalBusinessRecords,
      genericApprovals,
      regulatoryFees,
      tradeOrders,
      hotelRevenue,
      hotelDaily,
    ] = await Promise.all([
      rows(db, 'SELECT id, code, financial_year, financial_month, plate_no, customer_name, route_name, freight_total, taxed_freight, record_json FROM transport_order WHERE deleted_at IS NULL'),
      rows(db, 'SELECT category, record_json FROM transport_base_data'),
      rows(db, 'SELECT vehicle_id, plate_no, current_order_id FROM gps_transport_vehicle WHERE deleted_at IS NULL'),
      rows(db, 'SELECT vehicle_id, device_id FROM gps_vehicle_device_bind WHERE deleted_at IS NULL'),
      rows(db, 'SELECT device_id FROM gps_device WHERE deleted_at IS NULL'),
      rows(db, 'SELECT business_type, business_id FROM approval_instance WHERE deleted_at IS NULL'),
      rows(db, 'SELECT business_type, business_id FROM approval_business_record'),
      rows(db, 'SELECT business_type, business_id FROM approval_generic_business_record WHERE deleted_at IS NULL'),
      rows(db, 'SELECT id, fee_name, fee_type, plate_no, valid_start_date, valid_end_date, total_amount FROM regulatory_fee WHERE deleted_at IS NULL'),
      rows(db, 'SELECT code, order_json FROM trade_order WHERE deleted_at IS NULL'),
      rows(db, 'SELECT revenue_date, revenue_json FROM hotel_revenue WHERE deleted_at IS NULL'),
      rows(db, 'SELECT business_date, total_rooms, occupied_rooms FROM hotel_daily_operation'),
    ])

    const base = { vehicle: new Set(), customer: new Set(), route: new Set() }
    for (const row of baseData) {
      const record = parseJson(row.record_json)
      if (row.category === 'vehicle') {
        base.vehicle.add(plate(record.code))
        base.vehicle.add(plate(record.plateNo))
      }
      if (row.category === 'customer')
        base.customer.add(String(record.name || '').trim())
      if (row.category === 'route')
        base.route.add(routeKey(record.name))
    }

    let freightMismatch = 0
    let periodMismatch = 0
    const missingVehicles = new Set()
    const missingCustomers = new Set()
    const missingRoutes = new Set()
    const orderIds = new Set()
    for (const order of orders) {
      const record = parseJson(order.record_json)
      orderIds.add(String(order.id))
      orderIds.add(String(order.code))
      if (Math.abs(number(order.freight_total) - number(record.freightTotal)) > 0.01
        || Math.abs(number(order.taxed_freight) - number(record.taxedFreight)) > 0.01)
        freightMismatch++
      const month = String(record.financeMonth || '').replace(/\D/g, '')
      if (month && month !== `${order.financial_year}${String(order.financial_month).padStart(2, '0')}`)
        periodMismatch++
      const normalizedPlate = plate(order.plate_no)
      if (usablePlate(order.plate_no) && !base.vehicle.has(normalizedPlate))
        missingVehicles.add(normalizedPlate)
      if (order.customer_name && !base.customer.has(String(order.customer_name).trim()))
        missingCustomers.add(String(order.customer_name).trim())
      if (order.route_name && !base.route.has(routeKey(order.route_name)))
        missingRoutes.add(String(order.route_name).trim())
    }
    check(freightMismatch === 0, `运输订单结构化金额与 JSON 不一致: ${freightMismatch} 条`)
    check(periodMismatch === 0, `运输订单财务月字段不一致: ${periodMismatch} 条`)
    warn(missingVehicles.size === 0, `订单中 ${missingVehicles.size} 个有效车牌尚未持久化到车辆主档: ${[...missingVehicles].join('、')}`)
    warn(missingCustomers.size === 0, `订单中 ${missingCustomers.size} 个客户尚未持久化到客户主档`)
    warn(missingRoutes.size === 0, `订单中 ${missingRoutes.size} 条线路尚未持久化到线路主档`)

    const gpsVehicleIds = new Set(gpsVehicles.map(row => String(row.vehicle_id)))
    const gpsDeviceIds = new Set(gpsDevices.map(row => String(row.device_id)))
    const transportPlates = new Set(orders.map(row => plate(row.plate_no)).filter(Boolean))
    check(gpsVehicles.every(row => transportPlates.has(plate(row.plate_no))), '存在未关联运输订单的 GPS 车辆')
    check(gpsBinds.every(row => gpsVehicleIds.has(String(row.vehicle_id))), '存在孤立的 GPS 车辆绑定')
    check(gpsBinds.every(row => gpsDeviceIds.has(String(row.device_id))), '存在孤立的 GPS 设备绑定')
    check(gpsVehicles.every(row => !row.current_order_id || orderIds.has(String(row.current_order_id))), '存在 GPS 车辆关联了不存在的运输订单')

    const genericKeys = new Set(genericApprovals.map(row => `${row.business_type}:${row.business_id}`))
    const approvalBusinessKeys = new Set(approvalBusinessRecords.map(row => `${row.business_type}:${row.business_id}`))
    const feeIds = new Set(regulatoryFees.map(row => String(row.id)))
    const approvalOrphans = approvals.filter((approval) => {
      if (approval.business_type === 'transport_order')
        return !orderIds.has(String(approval.business_id))
      if (approval.business_type === 'transport_fee')
        return !feeIds.has(String(approval.business_id))
      const key = `${approval.business_type}:${approval.business_id}`
      return !approvalBusinessKeys.has(key) && !genericKeys.has(key)
    })
    check(approvalOrphans.length === 0, `审批实例关联的业务对象不存在: ${approvalOrphans.length} 条`)

    const feeKeys = new Set()
    let duplicateFees = 0
    for (const fee of regulatoryFees) {
      const key = [fee.fee_name, fee.fee_type, plate(fee.plate_no), dateKey(fee.valid_start_date), dateKey(fee.valid_end_date), number(fee.total_amount)].join('|')
      if (feeKeys.has(key))
        duplicateFees++
      feeKeys.add(key)
    }
    warn(duplicateFees === 0, `规费可能存在 ${duplicateFees} 条重复业务记录`)

    let tradeProfitMismatch = 0
    for (const row of tradeOrders) {
      const order = parseJson(row.order_json)
      const expected = number(order.receivableLiquidTotal) - number(order.payableTotal) - number(order.freightTotal) - number(order.cargoLoss)
      if (Math.abs(expected - number(order.profit)) > 0.01)
        tradeProfitMismatch++
    }
    check(tradeProfitMismatch === 0, `贸易订单利润公式不一致: ${tradeProfitMismatch} 条`)

    check(hotelDaily.every(row => number(row.total_rooms) >= 0 && number(row.occupied_rooms) >= 0 && number(row.occupied_rooms) <= number(row.total_rooms)), '酒店房态存在入住数超过房间总数或负数')
    check(hotelRevenue.every(row => dateKey(parseJson(row.revenue_json).date) === dateKey(row.revenue_date)), '酒店流水日期与结构化日期不一致')

    const latestPeriods = await rows(db, `
      SELECT financial_year, financial_month, COUNT(*) AS order_count,
             ROUND(SUM(freight_total), 2) AS freight_total,
             ROUND(SUM(taxed_freight), 2) AS taxed_freight
      FROM transport_order WHERE deleted_at IS NULL
      GROUP BY financial_year, financial_month
      ORDER BY financial_year DESC, financial_month DESC LIMIT 3
    `)
    const latest = latestPeriods[0]
    if (latest) {
      const periodKey = `${latest.financial_year}${String(latest.financial_month).padStart(2, '0')}`
      const overview = computeBusinessOverview({
        periodKey,
        transportOrders: orders.map(row => parseJson(row.record_json)),
        tradeOrders: tradeOrders.map(row => parseJson(row.order_json)),
        hotelRevenue: hotelRevenue.map(row => parseJson(row.revenue_json)),
        hotelDaily: hotelDaily.map(row => ({ date: dateKey(row.business_date), totalRooms: row.total_rooms, occupiedRooms: row.occupied_rooms })),
      })
      check(overview.transport.orderCount === number(latest.order_count), `首页运输订单数与运输模块不一致: ${overview.transport.orderCount} / ${latest.order_count}`)
      check(Math.abs(overview.transport.freight - number(latest.freight_total)) <= 0.01, `首页运费总额与运输模块不一致: ${overview.transport.freight} / ${latest.freight_total}`)
      check(Math.abs(overview.transport.taxedFreight - number(latest.taxed_freight)) <= 0.01, `首页税后运费与运输模块不一致: ${overview.transport.taxedFreight} / ${latest.taxed_freight}`)
    }
    console.table(latestPeriods)
    console.log(`[完整性] 运输 ${orders.length} 单，GPS ${gpsVehicles.length} 辆，规费 ${regulatoryFees.length} 条，审批 ${approvals.length} 条，贸易 ${tradeOrders.length} 单，酒店流水 ${hotelRevenue.length} 条`)
    warnings.forEach(message => console.warn(`[告警] ${message}`))
    if (failures.length)
      throw new Error(failures.join('\n'))
    console.log('[完整性] 跨模块关联和统计口径校验通过')
  }
  finally {
    await db.end()
  }
}

main().catch((error) => {
  console.error('[完整性] 校验失败')
  console.error(error.message || error)
  process.exit(1)
})
