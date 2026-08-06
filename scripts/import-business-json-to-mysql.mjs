import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { assertWriteEnabled, loadProductionEnv, mysqlConnectionOptions } from './mysql-env.mjs'

const root = process.cwd()
loadProductionEnv(root)

function readJson(file) {
  if (!fs.existsSync(file))
    return undefined
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value) {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(number) ? number : 0
}

function dateOnly(value) {
  const text = String(value || '').trim()
  return text ? text.slice(0, 10) : null
}

function dateTime(value) {
  const text = String(value || '').trim()
  if (!text)
    return null
  return text.length <= 10 ? `${text} 00:00:00` : text.replace('T', ' ').slice(0, 19)
}

function parseMonth(value, fallbackDate) {
  const text = String(value || '').trim()
  const match = text.match(/(\d{4})\D?(\d{1,2})/)
  if (match)
    return { year: Number(match[1]), month: Number(match[2]) }

  const date = String(fallbackDate || '').trim()
  const dateMatch = date.match(/(\d{4})-(\d{1,2})/)
  if (dateMatch)
    return { year: Number(dateMatch[1]), month: Number(dateMatch[2]) }

  return { year: null, month: null }
}

function recordKey(type, record, index) {
  if (record?.code)
    return String(record.code)
  if (record?.contractNo)
    return String(record.contractNo)
  if (record?.id != null)
    return String(record.id)
  return `${type}-${index + 1}`
}

function datasetPath(envName, fallback) {
  return process.env[envName] ? path.resolve(root, process.env[envName]) : path.join(root, fallback)
}

const files = {
  regulatoryFees: datasetPath('REGULATORY_FEES_IMPORT_FILE', 'storage/test-data/json/regulatory-fees.json'),
  officeVehicle: datasetPath('OFFICE_VEHICLE_IMPORT_FILE', 'storage/test-data/json/office-vehicle.json'),
  transportOperation: datasetPath('TRANSPORT_OPERATION_IMPORT_FILE', 'storage/test-data/json/transport-operation.json'),
  tradeOrders: datasetPath('TRADE_ORDERS_IMPORT_FILE', 'storage/test-data/json/trade-orders.json'),
  hotelRevenue: datasetPath('HOTEL_REVENUE_IMPORT_FILE', 'storage/test-data/json/hotel-revenue-records.json'),
}

async function clearTable(connection, table) {
  const [columns] = await connection.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, 'deleted_at'],
  )
  if (columns.length)
    await connection.execute(`UPDATE \`${table}\` SET deleted_at = NOW() WHERE deleted_at IS NULL`)
  else
    await connection.execute(`DELETE FROM \`${table}\``)
}

async function importRegulatoryFees(connection, records) {
  if (!records.length)
    return 0
  await clearTable(connection, 'regulatory_fee')
  for (const record of records) {
    await connection.execute(`
      INSERT INTO regulatory_fee (
        id, fee_name, fee_type, plate_no, trailer_no, area, total_amount,
        valid_start_date, valid_end_date, valid_months, monthly_amortized_amount,
        manual_status, approval_status, approval_instance_id, approved_at,
        rejected_at, revoked_at, remark, created_by, created_at, updated_at, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE
        fee_name = VALUES(fee_name), fee_type = VALUES(fee_type), plate_no = VALUES(plate_no),
        trailer_no = VALUES(trailer_no), area = VALUES(area), total_amount = VALUES(total_amount),
        valid_start_date = VALUES(valid_start_date), valid_end_date = VALUES(valid_end_date),
        valid_months = VALUES(valid_months), monthly_amortized_amount = VALUES(monthly_amortized_amount),
        manual_status = VALUES(manual_status), approval_status = VALUES(approval_status),
        approval_instance_id = VALUES(approval_instance_id), approved_at = VALUES(approved_at),
        rejected_at = VALUES(rejected_at), revoked_at = VALUES(revoked_at), remark = VALUES(remark),
        created_by = VALUES(created_by), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [
      record.id,
      record.feeName || record.feeType || '',
      record.feeType || record.feeName || '',
      record.plateNo || null,
      record.trailerNo || null,
      record.area || null,
      toNumber(record.totalAmount),
      dateOnly(record.validStartDate) || '1970-01-01',
      dateOnly(record.validEndDate) || '1970-01-01',
      Number(record.validMonths || 0),
      toNumber(record.monthlyAmortizedAmount),
      record.manualStatus || 'enabled',
      record.approvalStatus || '草稿',
      record.approvalInstanceId || null,
      dateTime(record.approvedAt),
      dateTime(record.rejectedAt),
      dateTime(record.revokedAt),
      record.remark || null,
      record.createdBy == null ? null : String(record.createdBy),
      dateTime(record.createdAt) || new Date(),
      dateTime(record.updatedAt) || new Date(),
    ])
  }
  return records.length
}

async function importTradeOrders(connection, records) {
  if (!records.length)
    return 0
  await clearTable(connection, 'trade_order')
  for (const row of records) {
    if (!row?.code)
      continue
    await connection.execute(`
      INSERT INTO trade_order (code, order_json, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE order_json = VALUES(order_json), updated_at = NOW(), deleted_at = NULL
    `, [row.code, JSON.stringify(row)])
  }
  return records.filter(row => row?.code).length
}

async function importHotelRevenue(connection, records) {
  if (!records.length)
    return 0
  await clearTable(connection, 'hotel_revenue')
  for (const row of records) {
    if (!row?.id || !row?.date)
      continue
    await connection.execute(`
      INSERT INTO hotel_revenue (id, revenue_date, revenue_json, created_at, updated_at, deleted_at)
      VALUES (?, ?, CAST(? AS JSON), NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE revenue_date = VALUES(revenue_date), revenue_json = VALUES(revenue_json), updated_at = NOW(), deleted_at = NULL
    `, [row.id, dateOnly(row.date) || '1970-01-01', JSON.stringify(row)])
  }
  return records.filter(row => row?.id && row?.date).length
}

function uniqueVehiclesFromTransport(data = {}) {
  const rows = [
    ...asArray(data.orders).map(row => ({
      plateNo: row.plateNo || row.vehicleInfo,
      driverName: row.driver,
      currentOrderId: row.id || row.code,
      currentOrderNo: row.code,
      routeLine: row.routeLine,
    })),
    ...asArray(data.fuels).map(row => ({
      plateNo: row.plateNo,
      driverName: row.driver,
    })),
    ...asArray(data.etc).map(row => ({
      plateNo: row.plateNo,
    })),
    ...asArray(data.driverPayrolls).map(row => ({
      plateNo: String(row.owner || row.plateNo || '').split('/')[0].trim(),
      driverName: row.name || row.driver,
    })),
  ].filter(row => row.plateNo)

  const map = new Map()
  for (const row of rows) {
    const key = String(row.plateNo).trim()
    if (!key)
      continue
    map.set(key, { ...(map.get(key) || {}), ...row, plateNo: key })
  }
  return [...map.values()]
}

function gpsPoint(index) {
  const points = [
    [36.6232, 101.7782, '西宁城东物流园'],
    [36.7241, 101.7498, '西宁北出口'],
    [36.3128, 102.8346, '平安服务区'],
    [36.0465, 103.8343, '兰州新区'],
    [35.8617, 104.1954, '兰州东收费站'],
    [34.3416, 108.9398, '西安北物流园'],
  ]
  return points[index % points.length]
}

async function importGpsFromTransport(connection, data = {}) {
  const vehicles = uniqueVehiclesFromTransport(data)
  if (!vehicles.length)
    return { vehicles: 0, devices: 0, binds: 0, locations: 0, trackPoints: 0, alarms: 0, geofences: 0 }

  for (const table of ['gps_operation_log', 'gps_sync_log', 'gps_geofence_vehicle', 'gps_geofence', 'gps_alarm', 'gps_track_point', 'gps_location_latest', 'gps_vehicle_device_bind', 'gps_device', 'gps_transport_vehicle', 'gps_provider_config'])
    await clearTable(connection, table)

  const createdAt = new Date().toISOString()
  await connection.execute(`
    INSERT INTO gps_provider_config (id, record_json, provider, name, enabled, created_at, updated_at, deleted_at)
    VALUES (?, CAST(? AS JSON), ?, ?, ?, NOW(), NOW(), NULL)
    ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), enabled = VALUES(enabled), updated_at = NOW(), deleted_at = NULL
  `, ['provider-808gps-demo', JSON.stringify({ id: 'provider-808gps-demo', provider: '808gps', name: '808GPS演示数据', enabled: true, tokenConfigured: false, createdAt, updatedAt: createdAt }), '808gps', '808GPS演示数据', 1])

  const fence = { id: 'fence-qh-main', name: '青海主运营区域', shape: 'circle', center: [101.7782, 36.6232], radius: 80000, enabled: true, createdAt, updatedAt: createdAt }
  await connection.execute(`
    INSERT INTO gps_geofence (id, record_json, name, shape, enabled, created_at, updated_at, deleted_at)
    VALUES (?, CAST(? AS JSON), ?, ?, ?, NOW(), NOW(), NULL)
    ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), name = VALUES(name), enabled = VALUES(enabled), updated_at = NOW(), deleted_at = NULL
  `, [fence.id, JSON.stringify(fence), fence.name, fence.shape, 1])

  let trackPoints = 0
  let alarms = 0
  for (const [index, vehicle] of vehicles.entries()) {
    const vehicleId = `veh-${String(index + 1).padStart(3, '0')}`
    const deviceId = `dev-${String(index + 1).padStart(3, '0')}`
    const bindId = `bind-${String(index + 1).padStart(3, '0')}`
    const [lat, lng, address] = gpsPoint(index)
    const onlineStatus = index % 5 === 4 ? 'offline' : 'online'
    const speed = onlineStatus === 'online' ? 36 + index * 7 : 0
    const vehicleRecord = { vehicleId, plateNo: vehicle.plateNo, driverId: `driver-${index + 1}`, driverName: vehicle.driverName || '未登记司机', currentOrderId: vehicle.currentOrderId, currentOrderNo: vehicle.currentOrderNo, routeLine: vehicle.routeLine, createdAt, updatedAt: createdAt }
    const deviceRecord = { deviceId, deviceNo: `GPS${String(index + 1).padStart(6, '0')}`, deviceName: `${vehicle.plateNo} 北斗终端`, provider: '808gps', simNo: `1440000${String(index + 1).padStart(4, '0')}`, onlineStatus, createdAt, updatedAt: createdAt }
    const bindRecord = { id: bindId, vehicleId, deviceId, plateNo: vehicle.plateNo, provider: '808gps', bindTime: createdAt, createdAt, updatedAt: createdAt }
    const location = { id: `loc-${String(index + 1).padStart(3, '0')}`, vehicleId, deviceId, plateNo: vehicle.plateNo, latitude: lat, longitude: lng, speed, direction: 90 + index * 12, altitude: 2200, accStatus: onlineStatus === 'online' ? 'on' : 'off', onlineStatus, locationTime: createdAt, address, provider: '808gps', rawData: { source: 'import' }, createdAt, updatedAt: createdAt }

    await connection.execute(`
      INSERT INTO gps_transport_vehicle (vehicle_id, record_json, plate_no, driver_name, owner_user_id, current_order_id, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, NULL, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), plate_no = VALUES(plate_no), driver_name = VALUES(driver_name), current_order_id = VALUES(current_order_id), updated_at = NOW(), deleted_at = NULL
    `, [vehicleId, JSON.stringify(vehicleRecord), vehicle.plateNo, vehicleRecord.driverName, vehicleRecord.currentOrderId || null])
    await connection.execute(`
      INSERT INTO gps_device (device_id, record_json, device_no, device_name, provider, online_status, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), device_no = VALUES(device_no), device_name = VALUES(device_name), online_status = VALUES(online_status), updated_at = NOW(), deleted_at = NULL
    `, [deviceId, JSON.stringify(deviceRecord), deviceRecord.deviceNo, deviceRecord.deviceName, '808gps', onlineStatus])
    await connection.execute(`
      INSERT INTO gps_vehicle_device_bind (id, record_json, vehicle_id, device_id, plate_no, provider, bind_time, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), vehicle_id = VALUES(vehicle_id), device_id = VALUES(device_id), plate_no = VALUES(plate_no), updated_at = NOW(), deleted_at = NULL
    `, [bindId, JSON.stringify(bindRecord), vehicleId, deviceId, vehicle.plateNo, '808gps', dateTime(createdAt)])
    await connection.execute(`
      INSERT INTO gps_location_latest (id, record_json, vehicle_id, device_id, plate_no, latitude, longitude, speed, online_status, location_time, provider, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), latitude = VALUES(latitude), longitude = VALUES(longitude), speed = VALUES(speed), online_status = VALUES(online_status), location_time = VALUES(location_time), updated_at = NOW(), deleted_at = NULL
    `, [location.id, JSON.stringify(location), vehicleId, deviceId, vehicle.plateNo, lat, lng, speed, onlineStatus, dateTime(createdAt), '808gps'])
    await connection.execute(`
      INSERT INTO gps_geofence_vehicle (id, record_json, geofence_id, vehicle_id, created_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), deleted_at = NULL
    `, [`fence-bind-${index + 1}`, JSON.stringify({ id: `fence-bind-${index + 1}`, geofenceId: fence.id, vehicleId, createdAt }), fence.id, vehicleId])

    for (let pointIndex = 0; pointIndex < 6; pointIndex += 1) {
      const [pointLat, pointLng, pointAddress] = gpsPoint(index + pointIndex)
      const pointTime = new Date(Date.now() - (6 - pointIndex) * 15 * 60 * 1000).toISOString()
      const point = { ...location, id: `trk-${index + 1}-${pointIndex + 1}`, latitude: pointLat, longitude: pointLng, speed: Math.max(0, speed - (5 - pointIndex) * 3), locationTime: pointTime, address: pointAddress, businessType: vehicle.currentOrderId ? 'transport_order' : undefined, businessId: vehicle.currentOrderId }
      await connection.execute(`
        INSERT INTO gps_track_point (id, record_json, vehicle_id, device_id, plate_no, latitude, longitude, speed, location_time, provider, business_type, business_id, created_at, updated_at, deleted_at)
        VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
        ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), latitude = VALUES(latitude), longitude = VALUES(longitude), speed = VALUES(speed), location_time = VALUES(location_time), deleted_at = NULL
      `, [point.id, JSON.stringify(point), vehicleId, deviceId, vehicle.plateNo, pointLat, pointLng, point.speed, dateTime(pointTime), '808gps', point.businessType || null, point.businessId || null])
      trackPoints += 1
    }

    if (index % 3 === 0) {
      const alarm = { id: `alarm-${index + 1}`, vehicleId, deviceId, plateNo: vehicle.plateNo, alarmType: speed > 55 ? '超速报警' : '离线提醒', alarmLevel: speed > 55 ? 'medium' : 'low', alarmTime: createdAt, latitude: lat, longitude: lng, speed, status: 'unhandled', provider: '808gps', businessType: vehicle.currentOrderId ? 'transport_order' : undefined, businessId: vehicle.currentOrderId, rawData: { source: 'import' }, createdAt, updatedAt: createdAt }
      await connection.execute(`
        INSERT INTO gps_alarm (id, record_json, vehicle_id, device_id, plate_no, alarm_type, alarm_level, alarm_time, status, provider, business_type, business_id, created_at, updated_at, deleted_at)
        VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
        ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), alarm_type = VALUES(alarm_type), alarm_level = VALUES(alarm_level), alarm_time = VALUES(alarm_time), status = VALUES(status), deleted_at = NULL
      `, [alarm.id, JSON.stringify(alarm), vehicleId, deviceId, vehicle.plateNo, alarm.alarmType, alarm.alarmLevel, dateTime(createdAt), alarm.status, '808gps', alarm.businessType || null, alarm.businessId || null])
      alarms += 1
    }
  }

  return { vehicles: vehicles.length, devices: vehicles.length, binds: vehicles.length, locations: vehicles.length, trackPoints, alarms, geofences: 1 }
}

async function importOfficeVehicle(connection, state = {}) {
  const vehicles = asArray(state.vehicles)
  const expenses = asArray(state.expenses)
  const licenses = asArray(state.licenses)
  const insurances = asArray(state.insurances)
  const reminders = asArray(state.reminders)
  const logs = asArray(state.logs)

  if (!vehicles.length && !expenses.length && !licenses.length && !insurances.length && !reminders.length && !logs.length)
    return { vehicles: 0, expenses: 0, licenses: 0, insurances: 0, reminders: 0, logs: 0 }

  for (const table of ['office_vehicle_operation_log', 'office_vehicle_reminder', 'office_vehicle_insurance', 'office_vehicle_license', 'office_vehicle_expense', 'office_vehicle'])
    await clearTable(connection, table)

  for (const item of vehicles) {
    await connection.execute(`
      INSERT INTO office_vehicle (id, plate_no, vehicle_type, brand_model, department_id, department_name, owner_user_id, owner_name, default_driver_id, default_driver_name, status, purchase_date, photo_url, remark, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE plate_no=VALUES(plate_no), vehicle_type=VALUES(vehicle_type), brand_model=VALUES(brand_model), department_id=VALUES(department_id), department_name=VALUES(department_name), owner_user_id=VALUES(owner_user_id), owner_name=VALUES(owner_name), default_driver_id=VALUES(default_driver_id), default_driver_name=VALUES(default_driver_name), status=VALUES(status), purchase_date=VALUES(purchase_date), photo_url=VALUES(photo_url), remark=VALUES(remark), updated_at=VALUES(updated_at), deleted_at=NULL
    `, [item.id, item.plateNo, item.vehicleType || '轿车', item.brandModel || '', item.departmentId == null ? null : String(item.departmentId), item.departmentName || '-', item.ownerUserId == null ? null : String(item.ownerUserId), item.ownerName || '-', item.defaultDriverId == null ? null : String(item.defaultDriverId), item.defaultDriverName || null, item.status || '正常', dateOnly(item.purchaseDate), item.photoUrl || null, item.remark || null, dateTime(item.createdAt) || new Date(), dateTime(item.updatedAt) || new Date()])
  }

  for (const item of expenses) {
    await connection.execute(`
      INSERT INTO office_vehicle_expense (id, vehicle_id, plate_no, expense_type, amount, occurred_date, handler_id, handler_name, department_id, department_name, payment_method, invoice_no, attachment_name, attachment_url, need_approval, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), expense_type=VALUES(expense_type), amount=VALUES(amount), occurred_date=VALUES(occurred_date), handler_id=VALUES(handler_id), handler_name=VALUES(handler_name), department_id=VALUES(department_id), department_name=VALUES(department_name), payment_method=VALUES(payment_method), invoice_no=VALUES(invoice_no), attachment_name=VALUES(attachment_name), attachment_url=VALUES(attachment_url), need_approval=VALUES(need_approval), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), remark=VALUES(remark), updated_at=VALUES(updated_at), deleted_at=NULL
    `, [item.id, item.vehicleId, item.plateNo || '', item.expenseType || '', toNumber(item.amount), dateOnly(item.occurredDate) || '1970-01-01', item.handlerId == null ? null : String(item.handlerId), item.handlerName || '', item.departmentId == null ? null : String(item.departmentId), item.departmentName || '', item.paymentMethod || '', item.invoiceNo || null, item.attachmentName || null, item.attachmentUrl || null, item.needApproval ? 1 : 0, item.approvalStatus || '草稿', item.approvalInstanceId || null, item.remark || null, dateTime(item.createdAt) || new Date(), dateTime(item.updatedAt) || new Date()])
  }

  for (const item of licenses) {
    await connection.execute(`
      INSERT INTO office_vehicle_license (id, vehicle_id, plate_no, license_type, license_no, issue_date, expiry_date, issuing_authority, attachment_name, attachment_url, status, remark, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), license_type=VALUES(license_type), license_no=VALUES(license_no), issue_date=VALUES(issue_date), expiry_date=VALUES(expiry_date), issuing_authority=VALUES(issuing_authority), attachment_name=VALUES(attachment_name), attachment_url=VALUES(attachment_url), status=VALUES(status), remark=VALUES(remark), updated_at=VALUES(updated_at), deleted_at=NULL
    `, [item.id, item.vehicleId, item.plateNo || '', item.licenseType || '', item.licenseNo || '', dateOnly(item.issueDate), dateOnly(item.expiryDate) || '1970-01-01', item.issuingAuthority || null, item.attachmentName || null, item.attachmentUrl || null, item.status || '有效', item.remark || null, dateTime(item.createdAt) || new Date(), dateTime(item.updatedAt) || new Date()])
  }

  for (const item of insurances) {
    await connection.execute(`
      INSERT INTO office_vehicle_insurance (id, vehicle_id, plate_no, insurance_type, policy_no, insurer, amount, start_date, end_date, attachment_name, status, remark, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), insurance_type=VALUES(insurance_type), policy_no=VALUES(policy_no), insurer=VALUES(insurer), amount=VALUES(amount), start_date=VALUES(start_date), end_date=VALUES(end_date), attachment_name=VALUES(attachment_name), status=VALUES(status), remark=VALUES(remark), updated_at=VALUES(updated_at), deleted_at=NULL
    `, [item.id, item.vehicleId, item.plateNo || '', item.insuranceType || '', item.policyNo || '', item.insurer || '', toNumber(item.amount), dateOnly(item.startDate) || '1970-01-01', dateOnly(item.endDate) || '1970-01-01', item.attachmentName || null, item.status || '有效', item.remark || null, dateTime(item.createdAt) || new Date(), dateTime(item.updatedAt) || new Date()])
  }

  for (const item of reminders) {
    await connection.execute(`
      INSERT INTO office_vehicle_reminder (id, vehicle_id, plate_no, reminder_type, due_date, remind_days, target_user_ids, target_names, status, handled, handled_at, handle_remark, source_type, source_id, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE vehicle_id=VALUES(vehicle_id), plate_no=VALUES(plate_no), reminder_type=VALUES(reminder_type), due_date=VALUES(due_date), remind_days=VALUES(remind_days), target_user_ids=VALUES(target_user_ids), target_names=VALUES(target_names), status=VALUES(status), handled=VALUES(handled), handled_at=VALUES(handled_at), handle_remark=VALUES(handle_remark), source_type=VALUES(source_type), source_id=VALUES(source_id), updated_at=VALUES(updated_at), deleted_at=NULL
    `, [item.id, item.vehicleId, item.plateNo || '', item.reminderType || '', dateOnly(item.dueDate) || '1970-01-01', Number(item.remindDays || 30), asArray(item.targetUserIds).join(','), asArray(item.targetNames).join(','), item.status || '正常', item.handled ? 1 : 0, dateTime(item.handledAt), item.handleRemark || null, item.sourceType || null, item.sourceId || null, dateTime(item.createdAt) || new Date(), dateTime(item.updatedAt) || new Date()])
  }

  for (const item of logs) {
    await connection.execute(`
      INSERT INTO office_vehicle_operation_log (id, module, record_id, action, operator_id, operator_name, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE module=VALUES(module), record_id=VALUES(record_id), action=VALUES(action), operator_id=VALUES(operator_id), operator_name=VALUES(operator_name), content=VALUES(content)
    `, [item.id, item.module || 'vehicle', item.recordId || '', item.action || '', item.operatorId == null ? null : String(item.operatorId), item.operatorName || '', item.content || '', dateTime(item.createdAt) || new Date()])
  }

  return { vehicles: vehicles.length, expenses: expenses.length, licenses: licenses.length, insurances: insurances.length, reminders: reminders.length, logs: logs.length }
}

async function importTransportOperation(connection, data = {}) {
  const dataset = {
    orders: asArray(data.orders),
    fuels: asArray(data.fuels),
    etc: asArray(data.etc),
    driverPayrolls: asArray(data.driverPayrolls),
    maintenance: asArray(data.maintenance),
    vehicleLoans: asArray(data.vehicleLoans),
  }

  if (!Object.values(dataset).some(rows => rows.length))
    return { orders: 0, fuels: 0, etc: 0, driverPayrolls: 0, maintenance: 0, vehicleLoans: 0, vehicleLoanPayments: 0 }

  for (const table of ['transport_vehicle_loan_payment', 'transport_vehicle_loan', 'transport_maintenance_order', 'transport_driver_payroll', 'transport_etc_record', 'transport_fuel_record', 'transport_order', 'transport_operation_record'])
    await clearTable(connection, table)

  for (const [index, record] of dataset.orders.entries()) {
    const month = parseMonth(record.financeMonth, record.shipDate)
    await connection.execute(`
      INSERT INTO transport_order (
        id, record_json, code, financial_year, financial_month, ship_date, customer_name, plate_no, trailer_no,
        driver_name, escort_name, route_name, loading_address, unloading_address, order_type, cargo_name,
        sent_weight, received_weight, distance_km, pricing_formula, freight_price, freight_total, tax_rate,
        taxed_freight, planned_fuel_quantity, actual_fuel_quantity, actual_fuel_amount, etc_fee, receipt_status,
        settlement_status, transport_status, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at
      )
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), ship_date=VALUES(ship_date), customer_name=VALUES(customer_name), plate_no=VALUES(plate_no), trailer_no=VALUES(trailer_no), driver_name=VALUES(driver_name), escort_name=VALUES(escort_name), route_name=VALUES(route_name), freight_total=VALUES(freight_total), taxed_freight=VALUES(taxed_freight), actual_fuel_quantity=VALUES(actual_fuel_quantity), actual_fuel_amount=VALUES(actual_fuel_amount), etc_fee=VALUES(etc_fee), transport_status=VALUES(transport_status), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), remark=VALUES(remark), updated_at=NOW(), deleted_at=NULL
    `, [record.id || record.code || recordKey('orders', record, index), JSON.stringify(record), record.code || recordKey('orders', record, index), month.year, month.month, dateOnly(record.shipDate) || '1970-01-01', record.customer || '', record.plateNo || record.vehicleInfo || '', record.trailerNo || '', record.driver || '', record.escort || '', record.routeLine || '', record.loadingAddress || '', record.unloadingAddress || '', record.orderType || '', record.cargoName || '', toNumber(record.sentWeight), toNumber(record.receivedWeight), toNumber(record.distance || record.mileage), record.pricingFormula || '吨位×单价', toNumber(record.freightPrice), toNumber(record.freightTotal), toNumber(record.taxRate || 9) / 100, toNumber(record.taxedFreight || record.freightTotal), toNumber(record.plannedFuelConsumption), toNumber(record.actualFuelVolume), toNumber(record.actualFuelAmount), toNumber(record.etcFee), record.receiptStatus || '', record.settlementStatus || '', record.status || '装车', record.approvalStatus || null, record.approvalInstanceId || null, record.remark || ''])
  }

  for (const [index, record] of dataset.fuels.entries()) {
    const month = parseMonth(record.month, record.date)
    await connection.execute(`
      INSERT INTO transport_fuel_record (id, record_json, code, financial_year, financial_month, fuel_time, plate_no, location, product, quantity, amount, driver_name, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), fuel_time=VALUES(fuel_time), plate_no=VALUES(plate_no), location=VALUES(location), product=VALUES(product), quantity=VALUES(quantity), amount=VALUES(amount), driver_name=VALUES(driver_name), updated_at=NOW(), deleted_at=NULL
    `, [record.id || record.code || recordKey('fuels', record, index), JSON.stringify(record), record.code || recordKey('fuels', record, index), month.year, month.month, dateTime(record.date) || '1970-01-01 00:00:00', record.plateNo || '', record.location || '', record.product || '', toNumber(record.quantity), toNumber(record.amount), record.driver || ''])
  }

  for (const [index, record] of dataset.etc.entries()) {
    const month = parseMonth(record.month, record.updatedAt)
    await connection.execute(`
      INSERT INTO transport_etc_record (id, record_json, code, financial_year, financial_month, pass_time, road_section, plate_no, card_no, invoice_no, amount, status, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), pass_time=VALUES(pass_time), road_section=VALUES(road_section), plate_no=VALUES(plate_no), card_no=VALUES(card_no), invoice_no=VALUES(invoice_no), amount=VALUES(amount), status=VALUES(status), updated_at=NOW(), deleted_at=NULL
    `, [record.id || record.code || recordKey('etc', record, index), JSON.stringify(record), record.code || recordKey('etc', record, index), month.year, month.month, dateTime(record.updatedAt) || '1970-01-01 00:00:00', record.name || '', record.plateNo || '', record.cardNo || '', record.invoiceNo || '', toNumber(record.amount), record.status || ''])
  }

  for (const [index, record] of dataset.driverPayrolls.entries()) {
    const month = parseMonth(record.financeMonth || record.month, record.updatedAt)
    await connection.execute(`
      INSERT INTO transport_driver_payroll (id, code, payroll_json, driver_name, plate_no, financial_year, financial_month, amount, status, approval_status, approval_instance_id, created_at, updated_at, deleted_at)
      VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE payroll_json=VALUES(payroll_json), driver_name=VALUES(driver_name), plate_no=VALUES(plate_no), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), amount=VALUES(amount), status=VALUES(status), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), updated_at=NOW(), deleted_at=NULL
    `, [record.id || record.code || recordKey('driverPayrolls', record, index), record.code || recordKey('driverPayrolls', record, index), JSON.stringify(record), record.name || record.driver || '', String(record.owner || record.plateNo || '').split('/')[0].trim(), month.year, month.month, toNumber(record.amount || record.netSalary), record.status || '', record.approvalStatus || null, record.approvalInstanceId || null])
  }

  for (const [index, record] of dataset.maintenance.entries()) {
    const month = parseMonth(record.financialMonth, record.repairDate)
    await connection.execute(`
      INSERT INTO transport_maintenance_order (id, record_json, code, plate_no, trailer_no, repair_date, financial_year, financial_month, project, shop, mileage, items, pay_type, driver_name, amount, status, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), plate_no=VALUES(plate_no), trailer_no=VALUES(trailer_no), repair_date=VALUES(repair_date), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), project=VALUES(project), shop=VALUES(shop), mileage=VALUES(mileage), items=VALUES(items), pay_type=VALUES(pay_type), driver_name=VALUES(driver_name), amount=VALUES(amount), status=VALUES(status), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), remark=VALUES(remark), updated_at=NOW(), deleted_at=NULL
    `, [record.id || record.code || recordKey('maintenance', record, index), JSON.stringify(record), record.code || `WX${record.id || index + 1}`, record.plateNo || '', record.trailerNo || '', dateOnly(record.repairDate) || '1970-01-01', month.year, month.month, record.project || '', record.shop || '', toNumber(record.mileage), record.items || '', record.payType || '', record.driver || '', toNumber(record.amount), record.status || '', record.approvalStatus || null, record.approvalInstanceId || null, record.remark || ''])
  }

  let vehicleLoanPayments = 0
  for (const [index, record] of dataset.vehicleLoans.entries()) {
    const loanId = record.id || record.contractNo || recordKey('vehicleLoans', record, index)
    await connection.execute(`
      INSERT INTO transport_vehicle_loan (id, record_json, contract_no, plate_no, trailer_no, lender, loan_amount, principal_amount, annual_rate, total_periods, start_date, first_due_date, monthly_payment, owner, status, approval_status, approval_instance_id, remark, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), plate_no=VALUES(plate_no), trailer_no=VALUES(trailer_no), lender=VALUES(lender), loan_amount=VALUES(loan_amount), principal_amount=VALUES(principal_amount), annual_rate=VALUES(annual_rate), total_periods=VALUES(total_periods), start_date=VALUES(start_date), first_due_date=VALUES(first_due_date), monthly_payment=VALUES(monthly_payment), owner=VALUES(owner), status=VALUES(status), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), remark=VALUES(remark), updated_at=NOW(), deleted_at=NULL
    `, [loanId, JSON.stringify(record), record.contractNo || record.code || loanId, record.plateNo || '', record.trailerNo || '', record.lender || '', toNumber(record.loanAmount), toNumber(record.principalAmount), toNumber(record.annualRate), Number(record.totalPeriods || 0), dateOnly(record.startDate) || '1970-01-01', dateOnly(record.firstDueDate) || '1970-01-01', toNumber(record.monthlyPayment), record.owner || '', record.status || '还款中', record.approvalStatus || null, record.approvalInstanceId || null, record.remark || ''])

    for (const payment of asArray(record.payments)) {
      await connection.execute(`
        INSERT INTO transport_vehicle_loan_payment (id, loan_id, period_no, payment_date, amount, principal, interest, method, voucher_no, remark, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
        ON DUPLICATE KEY UPDATE payment_date=VALUES(payment_date), amount=VALUES(amount), principal=VALUES(principal), interest=VALUES(interest), method=VALUES(method), voucher_no=VALUES(voucher_no), remark=VALUES(remark), updated_at=NOW(), deleted_at=NULL
      `, [payment.id || `${loanId}-p-${payment.periodNo}`, loanId, Number(payment.periodNo || 0), dateOnly(payment.paymentDate) || '1970-01-01', toNumber(payment.amount), toNumber(payment.principal), toNumber(payment.interest), payment.method || '', payment.voucherNo || '', payment.remark || ''])
      vehicleLoanPayments += 1
    }
  }

  return {
    orders: dataset.orders.length,
    fuels: dataset.fuels.length,
    etc: dataset.etc.length,
    driverPayrolls: dataset.driverPayrolls.length,
    maintenance: dataset.maintenance.length,
    vehicleLoans: dataset.vehicleLoans.length,
    vehicleLoanPayments,
  }
}

async function main() {
  const regulatoryFees = asArray(readJson(files.regulatoryFees))
  const tradeOrders = asArray(readJson(files.tradeOrders))
  const hotelRevenue = asArray(readJson(files.hotelRevenue))
  const officeVehicle = readJson(files.officeVehicle)
  const transportOperation = readJson(files.transportOperation)

  const plan = {
    regulatoryFees: regulatoryFees.length,
    tradeOrders: tradeOrders.length,
    hotelRevenue: hotelRevenue.length,
    officeVehicles: asArray(officeVehicle?.vehicles).length,
    officeVehicleExpenses: asArray(officeVehicle?.expenses).length,
    transportOrders: asArray(transportOperation?.orders).length,
    transportFuels: asArray(transportOperation?.fuels).length,
    transportEtc: asArray(transportOperation?.etc).length,
  }
  console.table(plan)
  assertWriteEnabled('IMPORT_BUSINESS_CONFIRM', '导入业务 JSON 数据')

  const connection = await mysql.createConnection(mysqlConnectionOptions())
  try {
    await connection.beginTransaction()
    const imported = {
      regulatoryFees: await importRegulatoryFees(connection, regulatoryFees),
      tradeOrders: await importTradeOrders(connection, tradeOrders),
      hotelRevenue: await importHotelRevenue(connection, hotelRevenue),
      officeVehicle: await importOfficeVehicle(connection, officeVehicle),
      transportOperation: await importTransportOperation(connection, transportOperation),
      gps: await importGpsFromTransport(connection, transportOperation),
    }
    await connection.commit()
    console.table(imported)
    console.log('[mysql:import:business] completed')
  }
  catch (error) {
    await connection.rollback()
    throw error
  }
  finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error('[mysql:import:business] failed')
  console.error(error)
  process.exit(1)
})
