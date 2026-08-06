import type mysql from 'mysql2/promise'
import { maintenancePermissions, withoutRecordPermissions } from '../services/vehicle-business/permissions'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'
import { ensureTransportOperationSchema, invalidateTransportOperationCache, transportOperationStore } from './transport-operation-store'

interface MaintenanceUser {
  id?: string | number
  roles?: Array<string | number>
}

export interface MaintenanceRecord extends Record<string, any> {
  id: number
  repairDate: string
  financialMonth: string
  plateNo: string
  project: string
  amount: number
  status: string
  createdBy?: string | number
}

export interface InventoryMovementRecord extends Record<string, any> {
  id: number
  code: string
  movementDate: string
  type: '入库' | '出库'
  partName: string
  specification: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function number(value: unknown) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function validDate(value: unknown) {
  const normalized = text(value).slice(0, 10)
  const match = normalized.match(/^(20\d{2})-(\d{2})-(\d{2})$/)
  if (!match)
    throw new Error('日期格式无效')
  const date = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(match[1]) || date.getMonth() + 1 !== Number(match[2]) || date.getDate() !== Number(match[3]))
    throw new Error('日期格式无效')
  return normalized
}

function financialPeriod(value: unknown, fallbackDate: string) {
  const normalized = text(value).replace(/\D/g, '').slice(0, 6) || fallbackDate.slice(0, 7).replace('-', '')
  const year = Number(normalized.slice(0, 4))
  const month = Number(normalized.slice(4, 6))
  if (year < 2000 || month < 1 || month > 12)
    throw new Error('财务月格式无效')
  return { key: `${year}${String(month).padStart(2, '0')}`, year, month }
}

function allowed(permission: unknown) {
  return permission === true || (typeof permission === 'object' && permission !== null && 'allowed' in permission && (permission as any).allowed === true)
}

function permissionReason(permission: unknown, fallback: string) {
  if (typeof permission === 'object' && permission !== null && 'reason' in permission)
    return text((permission as any).reason) || fallback
  return fallback
}

export function normalizeMaintenanceRecord(value: unknown, options: { id: number, createdBy?: string | number }) {
  const input = value && typeof value === 'object' ? value as Record<string, any> : {}
  const repairDate = validDate(input.repairDate)
  const period = financialPeriod(input.financialMonth, repairDate)
  const plateNo = text(input.plateNo).replace(/\s+/g, '')
  const project = text(input.project)
  const amount = number(input.amount)
  if (!plateNo)
    throw new Error('车牌号不能为空')
  if (!project)
    throw new Error('维修项目不能为空')
  if (amount < 0)
    throw new Error('维保金额不能小于 0')

  return {
    ...withoutRecordPermissions(input),
    id: options.id,
    repairDate,
    financialMonth: period.key,
    plateNo,
    trailerNo: text(input.trailerNo),
    project,
    shop: text(input.shop),
    mileage: number(input.mileage),
    items: text(input.items),
    payType: text(input.payType),
    driver: text(input.driver),
    amount,
    status: text(input.status) || '待审核',
    remark: text(input.remark),
    createdBy: options.createdBy,
  } as MaintenanceRecord
}

function normalizeInventoryMovement(value: unknown, id: number) {
  const input = value && typeof value === 'object' ? value as Record<string, any> : {}
  const movementDate = validDate(input.movementDate)
  const type = text(input.type)
  const partName = text(input.partName)
  const quantity = number(input.quantity)
  const unitPrice = number(input.unitPrice)
  if (!['入库', '出库'].includes(type))
    throw new Error('库存操作类型无效')
  if (!partName)
    throw new Error('配件名称不能为空')
  if (quantity <= 0)
    throw new Error('配件数量必须大于 0')
  if (unitPrice < 0)
    throw new Error('配件单价不能小于 0')
  const code = text(input.code) || `${type === '入库' ? 'RK' : 'CK'}${movementDate.replace(/-/g, '')}${String(id).padStart(4, '0')}`
  return {
    ...input,
    id,
    code,
    movementDate,
    type: type as '入库' | '出库',
    partName,
    specification: text(input.specification),
    unit: text(input.unit) || '件',
    quantity,
    unitPrice,
    amount: Number((quantity * unitPrice).toFixed(2)),
    supplier: text(input.supplier),
    plateNo: text(input.plateNo).replace(/\s+/g, ''),
    operator: text(input.operator),
    remark: text(input.remark),
    maintenanceId: input.maintenanceId == null ? undefined : number(input.maintenanceId),
  } as InventoryMovementRecord
}

async function nextNumericId(connection: mysql.PoolConnection, table: string) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), 0) AS max_id FROM ${table} WHERE id REGEXP '^[0-9]+$' FOR UPDATE`)
  return Number(rows[0]?.max_id || 0) + 1
}

function maintenanceParams(record: MaintenanceRecord) {
  const period = financialPeriod(record.financialMonth, record.repairDate)
  return [
    record.id,
    JSON.stringify(withoutRecordPermissions(record)),
    text(record.code) || `WX${record.id}`,
    record.plateNo,
    text(record.trailerNo),
    record.repairDate,
    period.year,
    period.month,
    record.project,
    text(record.shop),
    number(record.mileage),
    text(record.items),
    text(record.payType),
    text(record.driver),
    record.amount,
    record.status,
    text(record.approvalStatus) || null,
    text(record.approvalInstanceId) || null,
    record.remark,
    record.createdBy == null ? null : String(record.createdBy),
  ]
}

async function persistMaintenance(connection: mysql.PoolConnection, record: MaintenanceRecord) {
  await connection.execute(`
    INSERT INTO transport_maintenance_order (id, record_json, code, plate_no, trailer_no, repair_date, financial_year, financial_month, project, shop, mileage, items, pay_type, driver_name, amount, status, approval_status, approval_instance_id, remark, created_by, created_at, updated_at, deleted_at)
    VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
    ON DUPLICATE KEY UPDATE record_json=VALUES(record_json), plate_no=VALUES(plate_no), trailer_no=VALUES(trailer_no), repair_date=VALUES(repair_date), financial_year=VALUES(financial_year), financial_month=VALUES(financial_month), project=VALUES(project), shop=VALUES(shop), mileage=VALUES(mileage), items=VALUES(items), pay_type=VALUES(pay_type), driver_name=VALUES(driver_name), amount=VALUES(amount), status=VALUES(status), approval_status=VALUES(approval_status), approval_instance_id=VALUES(approval_instance_id), remark=VALUES(remark), created_by=COALESCE(created_by, VALUES(created_by)), updated_at=NOW(), deleted_at=NULL
  `, maintenanceParams(record))
}

async function persistInventoryMovement(connection: mysql.PoolConnection, record: InventoryMovementRecord) {
  await connection.execute(`
    INSERT INTO transport_inventory_movement (id, record_json, code, movement_date, movement_type, part_name, specification, quantity, unit_price, amount, plate_no, maintenance_id, created_at, updated_at, deleted_at)
    VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
  `, [record.id, JSON.stringify(record), record.code, record.movementDate, record.type, record.partName, record.specification, record.quantity, record.unitPrice, record.amount, record.plateNo, record.maintenanceId || null])
}

async function mysqlExistingMaintenance(connection: mysql.PoolConnection, id: number) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT record_json, created_by FROM transport_maintenance_order WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE', [id])
  if (!rows.length)
    return undefined
  const record = typeof rows[0].record_json === 'string' ? JSON.parse(rows[0].record_json) : (rows[0].record_json || {})
  return { ...record, id, createdBy: rows[0].created_by ?? record.createdBy } as MaintenanceRecord
}

function decorate(record: MaintenanceRecord, user: MaintenanceUser) {
  return { ...record, permissions: maintenancePermissions(record, { userId: user.id, roles: user.roles }) }
}

function maintenanceDuplicateKey(record: Pick<MaintenanceRecord, 'repairDate' | 'plateNo' | 'project' | 'amount'>) {
  return `${record.repairDate}|${record.plateNo}|${record.project}|${record.amount}`
}

async function saveLocalDataset(dataset: Awaited<ReturnType<typeof transportOperationStore.getDataset>>) {
  return transportOperationStore.replaceDataset({ ...dataset, confirmDestructiveReplace: true })
}

export const transportMaintenanceStore = {
  async create(value: unknown, user: MaintenanceUser) {
    const db = getMysqlPool()
    if (db) {
      await ensureTransportOperationSchema(db)
      const record = await withMysqlTransaction(db, async (connection) => {
        const id = await nextNumericId(connection, 'transport_maintenance_order')
        const normalized = normalizeMaintenanceRecord(value, { id, createdBy: user.id })
        await persistMaintenance(connection, normalized)
        return normalized
      })
      invalidateTransportOperationCache()
      return decorate(record, user)
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，维保数据禁止写入本地 JSON')
    const dataset = await transportOperationStore.getDataset()
    const id = Math.max(0, ...dataset.maintenance.map(item => number(item.id))) + 1
    const record = normalizeMaintenanceRecord(value, { id, createdBy: user.id })
    await saveLocalDataset({ ...dataset, maintenance: [record, ...dataset.maintenance] })
    return decorate(record, user)
  },

  async update(idValue: unknown, value: unknown, user: MaintenanceUser) {
    const id = number(idValue)
    if (!id)
      throw new Error('维保记录标识无效')
    const db = getMysqlPool()
    if (db) {
      await ensureTransportOperationSchema(db)
      const record = await withMysqlTransaction(db, async (connection) => {
        const existing = await mysqlExistingMaintenance(connection, id)
        if (!existing)
          throw new Error('维保记录不存在')
        const permission = maintenancePermissions(existing, { userId: user.id, roles: user.roles }).edit
        if (!allowed(permission))
          throw new Error(permissionReason(permission, '当前维保记录不允许修改'))
        const normalized = normalizeMaintenanceRecord(value, { id, createdBy: existing.createdBy ?? user.id })
        await persistMaintenance(connection, normalized)
        return normalized
      })
      invalidateTransportOperationCache()
      return decorate(record, user)
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，维保数据禁止写入本地 JSON')
    const dataset = await transportOperationStore.getDataset()
    const index = dataset.maintenance.findIndex(item => number(item.id) === id)
    if (index < 0)
      throw new Error('维保记录不存在')
    const existing = dataset.maintenance[index]
    const permission = maintenancePermissions(existing, { userId: user.id, roles: user.roles }).edit
    if (!allowed(permission))
      throw new Error(permissionReason(permission, '当前维保记录不允许修改'))
    const record = normalizeMaintenanceRecord(value, { id, createdBy: existing.createdBy ?? user.id })
    dataset.maintenance[index] = record
    await saveLocalDataset(dataset)
    return decorate(record, user)
  },

  async remove(idValue: unknown, user: MaintenanceUser) {
    const id = number(idValue)
    if (!id)
      throw new Error('维保记录标识无效')
    const db = getMysqlPool()
    if (db) {
      await ensureTransportOperationSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        const existing = await mysqlExistingMaintenance(connection, id)
        if (!existing)
          throw new Error('维保记录不存在')
        const permission = maintenancePermissions(existing, { userId: user.id, roles: user.roles }).delete
        if (!allowed(permission))
          throw new Error(permissionReason(permission, '当前维保记录不允许删除'))
        await connection.execute('UPDATE transport_maintenance_order SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?', [id])
      })
      invalidateTransportOperationCache()
      return
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，维保数据禁止写入本地 JSON')
    const dataset = await transportOperationStore.getDataset()
    const index = dataset.maintenance.findIndex(item => number(item.id) === id)
    if (index < 0)
      throw new Error('维保记录不存在')
    const permission = maintenancePermissions(dataset.maintenance[index], { userId: user.id, roles: user.roles }).delete
    if (!allowed(permission))
      throw new Error(permissionReason(permission, '当前维保记录不允许删除'))
    dataset.maintenance.splice(index, 1)
    await saveLocalDataset(dataset)
  },

  async importRecords(values: unknown, user: MaintenanceUser) {
    if (!Array.isArray(values) || !values.length)
      throw new Error('没有可导入的维保记录')
    if (values.length > 1000)
      throw new Error('单次最多导入 1000 条维保记录')
    const db = getMysqlPool()
    if (db) {
      await ensureTransportOperationSchema(db)
      const records = await withMysqlTransaction(db, async (connection) => {
        let nextId = await nextNumericId(connection, 'transport_maintenance_order')
        const normalized = values.map(value => normalizeMaintenanceRecord(value, { id: nextId++, createdBy: user.id }))
        const [existingRows] = await connection.query<mysql.RowDataPacket[]>('SELECT repair_date, plate_no, project, amount FROM transport_maintenance_order WHERE deleted_at IS NULL FOR UPDATE')
        const duplicateKeys = new Set(existingRows.map(row => maintenanceDuplicateKey({
          repairDate: text(row.repair_date).slice(0, 10),
          plateNo: text(row.plate_no).replace(/\s+/g, ''),
          project: text(row.project),
          amount: number(row.amount),
        })))
        normalized.forEach((record) => {
          const key = maintenanceDuplicateKey(record)
          if (duplicateKeys.has(key))
            throw new Error(`发现重复维保记录：${record.plateNo} / ${record.project}`)
          duplicateKeys.add(key)
        })
        for (const record of normalized)
          await persistMaintenance(connection, record)
        return normalized
      })
      invalidateTransportOperationCache()
      return records.map(record => decorate(record, user))
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，维保数据禁止写入本地 JSON')
    const dataset = await transportOperationStore.getDataset()
    let nextId = Math.max(0, ...dataset.maintenance.map(item => number(item.id))) + 1
    const records = values.map(value => normalizeMaintenanceRecord(value, { id: nextId++, createdBy: user.id }))
    const duplicateKeys = new Set(dataset.maintenance.map(item => maintenanceDuplicateKey(item as MaintenanceRecord)))
    records.forEach((record) => {
      const key = maintenanceDuplicateKey(record)
      if (duplicateKeys.has(key))
        throw new Error(`发现重复维保记录：${record.plateNo} / ${record.project}`)
      duplicateKeys.add(key)
    })
    await saveLocalDataset({ ...dataset, maintenance: [...records, ...dataset.maintenance] })
    return records.map(record => decorate(record, user))
  },

  async createInventoryOperation(value: any, user: MaintenanceUser) {
    const db = getMysqlPool()
    if (db) {
      await ensureTransportOperationSchema(db)
      const result = await withMysqlTransaction(db, async (connection) => {
        const movementId = await nextNumericId(connection, 'transport_inventory_movement')
        const movement = normalizeInventoryMovement(value?.movement, movementId)
        let maintenance: MaintenanceRecord | undefined
        if (movement.type === '出库') {
          const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT COALESCE(SUM(CASE WHEN movement_type = \'入库\' THEN quantity ELSE -quantity END), 0) AS balance FROM transport_inventory_movement WHERE deleted_at IS NULL AND part_name = ? AND specification = ? FOR UPDATE', [movement.partName, movement.specification])
          if (number(rows[0]?.balance) < movement.quantity)
            throw new Error(`库存不足，当前可用 ${number(rows[0]?.balance)} ${movement.unit}`)
          const maintenanceId = await nextNumericId(connection, 'transport_maintenance_order')
          maintenance = normalizeMaintenanceRecord({
            ...value?.maintenance,
            remark: [`库存出库单 ${movement.code}`, text(value?.maintenance?.remark)].filter(Boolean).join('；'),
          }, { id: maintenanceId, createdBy: user.id })
          movement.maintenanceId = maintenanceId
          await persistMaintenance(connection, maintenance)
        }
        await persistInventoryMovement(connection, movement)
        return { movement, maintenance }
      })
      invalidateTransportOperationCache()
      return { movement: result.movement, maintenance: result.maintenance ? decorate(result.maintenance, user) : undefined }
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，库存数据禁止写入本地 JSON')
    const dataset = await transportOperationStore.getDataset()
    const movementId = Math.max(0, ...dataset.inventoryMovements.map(item => number(item.id))) + 1
    const movement = normalizeInventoryMovement(value?.movement, movementId)
    let maintenance: MaintenanceRecord | undefined
    if (movement.type === '出库') {
      const balance = dataset.inventoryMovements
        .filter(item => text(item.partName) === movement.partName && text(item.specification) === movement.specification)
        .reduce((sum, item) => sum + (item.type === '入库' ? number(item.quantity) : -number(item.quantity)), 0)
      if (balance < movement.quantity)
        throw new Error(`库存不足，当前可用 ${balance} ${movement.unit}`)
      const maintenanceId = Math.max(0, ...dataset.maintenance.map(item => number(item.id))) + 1
      maintenance = normalizeMaintenanceRecord({
        ...value?.maintenance,
        remark: [`库存出库单 ${movement.code}`, text(value?.maintenance?.remark)].filter(Boolean).join('；'),
      }, { id: maintenanceId, createdBy: user.id })
      movement.maintenanceId = maintenanceId
      dataset.maintenance.unshift(maintenance)
    }
    dataset.inventoryMovements.unshift(movement)
    await saveLocalDataset(dataset)
    return { movement, maintenance: maintenance ? decorate(maintenance, user) : undefined }
  },
}
