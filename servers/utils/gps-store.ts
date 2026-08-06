import type mysql from 'mysql2/promise'
import type { GpsAlarmPayload as AlarmPayload, GpsDevicePayload as DevicePayload, GpsProviderAdapter, GpsLocationPayload as LocationPayload } from '../services/gps/providers/types'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { getTimedGeofenceTransition, isLocationTimeAfter, isPointInGeofence } from '../../src/utils/geofence'
import { handleAlarmRecord, listAlarmRecords, mergeSyncedAlarms } from '../repositories/gps/alarm-repository'
import { withGeofenceVehicles as attachGeofenceVehicles, bindGeofenceVehicles, saveGeofence } from '../repositories/gps/geofence-repository'
import { replaceVehicleTrack } from '../repositories/gps/track-repository'
import { create808GpsProvider, get808AlarmReason, resolve808GpsCoordinates } from '../services/gps/providers/gps808-adapter'
import { mapWithConcurrency, resolveAddress, sanitizeGpsAddress, shouldRepairGpsAddress, validPreviousAddress, withSanitizedAddress } from '../services/gps/reverse-geocoding-adapter'
import { getMysqlPool, withMysqlTransaction } from './mysql'
import { transportOperationStore } from './transport-operation-store'

export { resolve808GpsCoordinates } from '../services/gps/providers/gps808-adapter'
export { fallbackGpsLocation, formatGpsLocation, formatPhotonLocation, mergeReverseGeocodeLocation, sanitizeGpsAddress, shouldRepairGpsAddress } from '../services/gps/reverse-geocoding-adapter'

type GpsProvider = '808gps'
type OnlineStatus = 'online' | 'offline' | 'unknown'
type AccStatus = 'on' | 'off' | 'unknown'
type AlarmStatus = 'unhandled' | 'handled' | 'ignored'
type SyncStatus = 'success' | 'failed'
type GeofenceTransition = 'enter' | 'exit'

export function resolveTransportStatusFromGeofence(
  currentStatus: string,
  fence: Pick<GpsGeofence, 'id' | 'name' | 'routeStage'>,
  transition: GeofenceTransition,
) {
  if (fence.routeStage === 'loading')
    return transition === 'enter' ? '装车' : '运输中'
  if (fence.routeStage === 'unloading')
    return transition === 'enter' ? '卸车' : '空返'
  return currentStatus
}

export function resolveTransportStatusAtLocation(
  currentStatus: string,
  point: [number, number],
  fences: GpsGeofence[],
  latestAlarm?: Pick<GpsAlarmRecord, 'rawData'>,
) {
  const containing = fences
    .filter(fence => fence.enabled && fence.routeStage && isPointInGeofence(point, fence))
    .sort((a, b) => Number(a.radius ?? Number.MAX_SAFE_INTEGER) - Number(b.radius ?? Number.MAX_SAFE_INTEGER))[0]
  if (containing?.routeStage === 'loading')
    return '装车'
  if (containing?.routeStage === 'unloading')
    return '卸车'

  const stage = latestAlarm?.rawData?.routeStage
  const transition = latestAlarm?.rawData?.transition
  if ((stage === 'loading' || stage === 'unloading') && (transition === 'enter' || transition === 'exit'))
    return resolveTransportStatusFromGeofence(currentStatus, { id: '', name: '', routeStage: stage }, transition)
  if (/^(?:待审核|已通过|待派车|待装车|装车|草稿)$/.test(currentStatus))
    return '运输中'
  if (currentStatus === '卸车')
    return '空返'
  return currentStatus
}

export interface GpsProviderConfig {
  id: string
  provider: GpsProvider
  name: string
  baseUrl?: string
  monitorUrl?: string
  username?: string
  enabled: boolean
  tokenConfigured: boolean
  createdAt: string
  updatedAt: string
}

export interface TransportVehicle {
  vehicleId: string
  plateNo: string
  driverId: string
  driverName: string
  ownerUserId?: string | number
  currentOrderId?: string
  currentOrderNo?: string
  routeLine?: string
}

export interface GpsDevice {
  deviceId: string
  deviceNo: string
  deviceName: string
  provider: GpsProvider
  simNo?: string
  onlineStatus: OnlineStatus
  rawData?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface VehicleDeviceBind {
  id: string
  vehicleId: string
  deviceId: string
  plateNo: string
  provider: GpsProvider
  bindTime: string
  createdAt: string
  updatedAt: string
}

export interface GpsLocationLatest {
  id: string
  vehicleId: string
  deviceId: string
  plateNo: string
  latitude: number
  longitude: number
  speed: number
  direction: number
  altitude: number
  accStatus: AccStatus
  onlineStatus: OnlineStatus
  locationTime: string
  address: string
  provider: GpsProvider
  rawData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface GpsTrackPoint extends Omit<GpsLocationLatest, 'id'> {
  id: string
  businessType?: string
  businessId?: string
}

export interface GpsAlarmRecord {
  id: string
  vehicleId: string
  deviceId: string
  plateNo: string
  alarmType: string
  alarmLevel: 'low' | 'medium' | 'high'
  alarmTime: string
  latitude: number
  longitude: number
  address?: string
  speed: number
  status: AlarmStatus
  handleRemark?: string
  handledBy?: string
  handledAt?: string
  provider: GpsProvider
  businessType?: string
  businessId?: string
  rawData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface GpsGeofence {
  id: string
  name: string
  address?: string
  shape: 'circle' | 'polygon'
  center?: [number, number]
  radius?: number
  points?: Array<[number, number]>
  routeCode?: string
  routeName?: string
  routeStage?: 'loading' | 'unloading'
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface GpsGeofenceVehicle {
  id: string
  geofenceId: string
  vehicleId: string
  createdAt: string
}

export interface GpsSyncLog {
  id: string
  provider: GpsProvider
  syncType: 'devices' | 'latest-location' | 'tracks' | 'alarms'
  status: SyncStatus
  message: string
  startedAt: string
  finishedAt: string
  rawData?: Record<string, any>
}

export interface GpsOperationLog {
  id: string
  action: string
  operatorId: string | number
  operatorName: string
  targetType: string
  targetId: string
  message: string
  createdAt: string
  rawData?: Record<string, any>
}

interface GpsState {
  seq: number
  providerConfigs: GpsProviderConfig[]
  vehicles: TransportVehicle[]
  devices: GpsDevice[]
  binds: VehicleDeviceBind[]
  latestLocations: GpsLocationLatest[]
  trackPoints: GpsTrackPoint[]
  alarms: GpsAlarmRecord[]
  geofences: GpsGeofence[]
  geofenceVehicles: GpsGeofenceVehicle[]
  syncLogs: GpsSyncLog[]
  operationLogs: GpsOperationLog[]
}

function isValidLngLat(point: [number, number]) {
  return point.length === 2 && point.every(Number.isFinite)
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90
}

function withNormalizedAlarm(item: GpsAlarmRecord): GpsAlarmRecord {
  const rawData = item.rawData ?? {}
  const gps = rawData.Gps && typeof rawData.Gps === 'object' ? rawData.Gps : rawData
  const coordinates = resolve808GpsCoordinates(gps)
  return {
    ...item,
    alarmType: rawData.type !== undefined ? get808AlarmReason(rawData) : item.alarmType,
    latitude: coordinates.latitude || item.latitude,
    longitude: coordinates.longitude || item.longitude,
    speed: item.speed || Number(gps.sp ?? 0) / 10,
  }
}

declare global {
  // eslint-disable-next-line vars-on-top
  var __gpsState: GpsState | undefined
}

const now = () => new Date().toISOString()
let hydrated = false
let hydrationPromise: Promise<GpsState> | undefined
let persistQueue: Promise<void> = Promise.resolve()

function nextId(prefix: string) {
  const state = getState()
  state.seq += 1
  return `${prefix}-${state.seq}`
}

function env(name: string) {
  return process.env[name] || ''
}

async function ensureColumn(db: mysql.Pool, table: string, column: string, definition: string) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  catch (error: any) {
    if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(error?.code))
      throw error
  }
}

async function ensureGpsSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_provider_config (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      provider VARCHAR(32) NOT NULL,
      name VARCHAR(128) NOT NULL,
      enabled TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_provider_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_transport_vehicle (
      vehicle_id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      plate_no VARCHAR(32) NOT NULL,
      driver_name VARCHAR(128) NULL,
      owner_user_id VARCHAR(64) NULL,
      current_order_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_vehicle_plate (plate_no),
      KEY idx_gps_vehicle_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_device (
      device_id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      device_no VARCHAR(128) NOT NULL,
      device_name VARCHAR(128) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      online_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_device_no (device_no),
      KEY idx_gps_device_status (online_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_vehicle_device_bind (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      plate_no VARCHAR(32) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      bind_time DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      UNIQUE KEY uk_gps_bind_vehicle (vehicle_id),
      UNIQUE KEY uk_gps_bind_device (device_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_location_latest (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      plate_no VARCHAR(32) NOT NULL,
      latitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
      longitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
      speed DECIMAL(10, 2) NOT NULL DEFAULT 0,
      online_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
      location_time DATETIME NULL,
      provider VARCHAR(32) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      UNIQUE KEY uk_gps_location_device (device_id),
      KEY idx_gps_location_vehicle (vehicle_id),
      KEY idx_gps_location_time (location_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_track_point (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      plate_no VARCHAR(32) NOT NULL,
      latitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
      longitude DECIMAL(12, 8) NOT NULL DEFAULT 0,
      speed DECIMAL(10, 2) NOT NULL DEFAULT 0,
      location_time DATETIME NULL,
      provider VARCHAR(32) NOT NULL,
      business_type VARCHAR(64) NULL,
      business_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_track_vehicle_time (vehicle_id, location_time),
      KEY idx_gps_track_business (business_type, business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_alarm (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      device_id VARCHAR(64) NOT NULL,
      plate_no VARCHAR(32) NOT NULL,
      alarm_type VARCHAR(64) NOT NULL,
      alarm_level VARCHAR(32) NOT NULL,
      alarm_time DATETIME NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'unhandled',
      provider VARCHAR(32) NOT NULL,
      business_type VARCHAR(64) NULL,
      business_id VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_alarm_vehicle_time (vehicle_id, alarm_time),
      KEY idx_gps_alarm_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_geofence (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      name VARCHAR(128) NOT NULL,
      shape VARCHAR(32) NOT NULL,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_geofence_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_geofence_vehicle (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      geofence_id VARCHAR(64) NOT NULL,
      vehicle_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_geofence_vehicle_fence (geofence_id),
      KEY idx_gps_geofence_vehicle_vehicle (vehicle_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_sync_log (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      provider VARCHAR(32) NOT NULL,
      sync_type VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_sync_log_finished (finished_at),
      KEY idx_gps_sync_log_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_operation_log (
      id VARCHAR(64) PRIMARY KEY,
      record_json JSON NOT NULL,
      action VARCHAR(64) NOT NULL,
      operator_id VARCHAR(64) NULL,
      operator_name VARCHAR(128) NULL,
      target_type VARCHAR(64) NOT NULL,
      target_id VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_gps_operation_log_target (target_type, target_id),
      KEY idx_gps_operation_log_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS gps_state (
      id VARCHAR(64) PRIMARY KEY,
      state_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureColumn(db, 'gps_sync_log', 'deleted_at', 'DATETIME NULL')
  await ensureColumn(db, 'gps_operation_log', 'deleted_at', 'DATETIME NULL')
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null)
    return fallback
  if (typeof value === 'string')
    return JSON.parse(value) as T
  return value as T
}

function toDbDateTime(value: unknown) {
  const text = String(value || '').trim()
  if (!text)
    return null
  return text.length <= 10 ? `${text} 00:00:00` : text.replace('T', ' ').slice(0, 19)
}

async function readJsonRows<T>(db: mysql.Pool, table: string, column = 'record_json') {
  const [rows] = await db.query<mysql.RowDataPacket[]>(`SELECT ${column} AS record_json FROM ${table} WHERE deleted_at IS NULL ORDER BY created_at ASC`)
  return rows.map((row: any) => parseJson<T>(row.record_json, {} as T))
}

async function loadStructuredState(db: mysql.Pool): Promise<{ hasData: boolean, state: GpsState }> {
  const state: GpsState = {
    seq: 1000,
    providerConfigs: await readJsonRows<GpsProviderConfig>(db, 'gps_provider_config'),
    vehicles: await readJsonRows<TransportVehicle>(db, 'gps_transport_vehicle'),
    devices: await readJsonRows<GpsDevice>(db, 'gps_device'),
    binds: await readJsonRows<VehicleDeviceBind>(db, 'gps_vehicle_device_bind'),
    latestLocations: await readJsonRows<GpsLocationLatest>(db, 'gps_location_latest'),
    trackPoints: await readJsonRows<GpsTrackPoint>(db, 'gps_track_point'),
    alarms: await readJsonRows<GpsAlarmRecord>(db, 'gps_alarm'),
    geofences: await readJsonRows<GpsGeofence>(db, 'gps_geofence'),
    geofenceVehicles: await readJsonRows<GpsGeofenceVehicle>(db, 'gps_geofence_vehicle'),
    syncLogs: await readJsonRows<GpsSyncLog>(db, 'gps_sync_log'),
    operationLogs: await readJsonRows<GpsOperationLog>(db, 'gps_operation_log'),
  }

  const ids = [
    ...state.providerConfigs,
    ...state.vehicles.map(item => ({ id: item.vehicleId })),
    ...state.devices.map(item => ({ id: item.deviceId })),
    ...state.binds,
    ...state.latestLocations,
    ...state.trackPoints,
    ...state.alarms,
    ...state.geofences,
    ...state.geofenceVehicles,
    ...state.syncLogs,
    ...state.operationLogs,
  ]
    .map((item: any) => String(item.id || '').match(/(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
  state.seq = Math.max(1000, ...ids)

  const hasData = state.providerConfigs.length > 0
    || state.vehicles.length > 0
    || state.devices.length > 0
    || state.latestLocations.length > 0
    || state.alarms.length > 0
    || state.geofences.length > 0
  return { hasData, state }
}

async function loadLegacyState(db: mysql.Pool) {
  const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT state_json FROM gps_state WHERE id = ? LIMIT 1', ['default'])
  return rows.length ? parseJson<GpsState>((rows[0] as any).state_json, createInitialState()) : undefined
}

async function clearStructuredState(db: mysql.Pool | mysql.PoolConnection) {
  for (const table of [
    'gps_provider_config',
    'gps_transport_vehicle',
    'gps_device',
    'gps_vehicle_device_bind',
    'gps_location_latest',
    'gps_track_point',
    'gps_alarm',
    'gps_geofence',
    'gps_geofence_vehicle',
    'gps_sync_log',
    'gps_operation_log',
  ]) {
    await db.execute(`UPDATE ${table} SET deleted_at = NOW() WHERE deleted_at IS NULL`)
  }
}

async function persistStructuredState(db: mysql.Pool | mysql.PoolConnection, state: GpsState) {
  await clearStructuredState(db)

  for (const row of state.providerConfigs) {
    await db.execute(`
      INSERT INTO gps_provider_config (id, record_json, provider, name, enabled, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), provider = VALUES(provider), name = VALUES(name), enabled = VALUES(enabled), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.provider, row.name, row.enabled ? 1 : 0, toDbDateTime(row.createdAt) || now(), toDbDateTime(row.updatedAt) || now()])
  }
  for (const row of state.vehicles) {
    await db.execute(`
      INSERT INTO gps_transport_vehicle (vehicle_id, record_json, plate_no, driver_name, owner_user_id, current_order_id, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), plate_no = VALUES(plate_no), driver_name = VALUES(driver_name), owner_user_id = VALUES(owner_user_id), current_order_id = VALUES(current_order_id), updated_at = NOW(), deleted_at = NULL
    `, [row.vehicleId, JSON.stringify(row), row.plateNo, row.driverName || null, row.ownerUserId == null ? null : String(row.ownerUserId), row.currentOrderId || null])
  }
  for (const row of state.devices) {
    await db.execute(`
      INSERT INTO gps_device (device_id, record_json, device_no, device_name, provider, online_status, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), device_no = VALUES(device_no), device_name = VALUES(device_name), provider = VALUES(provider), online_status = VALUES(online_status), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [row.deviceId, JSON.stringify(row), row.deviceNo, row.deviceName, row.provider, row.onlineStatus, toDbDateTime(row.createdAt) || now(), toDbDateTime(row.updatedAt) || now()])
  }
  for (const row of state.binds) {
    await db.execute(`
      INSERT INTO gps_vehicle_device_bind (id, record_json, vehicle_id, device_id, plate_no, provider, bind_time, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), vehicle_id = VALUES(vehicle_id), device_id = VALUES(device_id), plate_no = VALUES(plate_no), provider = VALUES(provider), bind_time = VALUES(bind_time), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.vehicleId, row.deviceId, row.plateNo, row.provider, toDbDateTime(row.bindTime), toDbDateTime(row.createdAt) || now(), toDbDateTime(row.updatedAt) || now()])
  }
  for (const row of state.latestLocations) {
    await db.execute(`
      INSERT INTO gps_location_latest (id, record_json, vehicle_id, device_id, plate_no, latitude, longitude, speed, online_status, location_time, provider, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), vehicle_id = VALUES(vehicle_id), plate_no = VALUES(plate_no), latitude = VALUES(latitude), longitude = VALUES(longitude), speed = VALUES(speed), online_status = VALUES(online_status), location_time = VALUES(location_time), provider = VALUES(provider), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.vehicleId, row.deviceId, row.plateNo, row.latitude, row.longitude, row.speed, row.onlineStatus, toDbDateTime(row.locationTime), row.provider, toDbDateTime(row.createdAt) || now(), toDbDateTime(row.updatedAt) || now()])
  }
  for (const row of state.trackPoints) {
    await db.execute(`
      INSERT INTO gps_track_point (id, record_json, vehicle_id, device_id, plate_no, latitude, longitude, speed, location_time, provider, business_type, business_id, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), latitude = VALUES(latitude), longitude = VALUES(longitude), speed = VALUES(speed), location_time = VALUES(location_time), business_type = VALUES(business_type), business_id = VALUES(business_id), updated_at = NOW(), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.vehicleId, row.deviceId, row.plateNo, row.latitude, row.longitude, row.speed, toDbDateTime(row.locationTime), row.provider, row.businessType || null, row.businessId || null])
  }
  for (const row of state.alarms) {
    await db.execute(`
      INSERT INTO gps_alarm (id, record_json, vehicle_id, device_id, plate_no, alarm_type, alarm_level, alarm_time, status, provider, business_type, business_id, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), alarm_type = VALUES(alarm_type), alarm_level = VALUES(alarm_level), alarm_time = VALUES(alarm_time), status = VALUES(status), business_type = VALUES(business_type), business_id = VALUES(business_id), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.vehicleId, row.deviceId, row.plateNo, row.alarmType, row.alarmLevel, toDbDateTime(row.alarmTime), row.status, row.provider, row.businessType || null, row.businessId || null, toDbDateTime(row.createdAt) || now(), toDbDateTime(row.updatedAt) || now()])
  }
  for (const row of state.geofences) {
    await db.execute(`
      INSERT INTO gps_geofence (id, record_json, name, shape, enabled, created_at, updated_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), name = VALUES(name), shape = VALUES(shape), enabled = VALUES(enabled), updated_at = VALUES(updated_at), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.name, row.shape, row.enabled ? 1 : 0, toDbDateTime(row.createdAt) || now(), toDbDateTime(row.updatedAt) || now()])
  }
  for (const row of state.geofenceVehicles) {
    await db.execute(`
      INSERT INTO gps_geofence_vehicle (id, record_json, geofence_id, vehicle_id, created_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), geofence_id = VALUES(geofence_id), vehicle_id = VALUES(vehicle_id), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.geofenceId, row.vehicleId, toDbDateTime(row.createdAt) || now()])
  }
  for (const row of state.syncLogs) {
    await db.execute(`
      INSERT INTO gps_sync_log (id, record_json, provider, sync_type, status, started_at, finished_at, created_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, NOW(), NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), status = VALUES(status), finished_at = VALUES(finished_at), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.provider, row.syncType, row.status, toDbDateTime(row.startedAt), toDbDateTime(row.finishedAt)])
  }
  for (const row of state.operationLogs) {
    await db.execute(`
      INSERT INTO gps_operation_log (id, record_json, action, operator_id, operator_name, target_type, target_id, created_at, deleted_at)
      VALUES (?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), action = VALUES(action), operator_id = VALUES(operator_id), operator_name = VALUES(operator_name), target_type = VALUES(target_type), target_id = VALUES(target_id), deleted_at = NULL
    `, [row.id, JSON.stringify(row), row.action, String(row.operatorId), row.operatorName, row.targetType, row.targetId, toDbDateTime(row.createdAt) || now()])
  }
}

async function hydrateState() {
  if (hydrated)
    return getState()

  if (hydrationPromise)
    return hydrationPromise

  hydrationPromise = (async () => {
    const db = getMysqlPool()
    if (!db) {
      hydrated = true
      return getState()
    }

    await ensureGpsSchema(db)
    const structured = await loadStructuredState(db)
    if (structured.hasData) {
      globalThis.__gpsState = structured.state
    }
    else {
      globalThis.__gpsState = await loadLegacyState(db) || getState()
      await withMysqlTransaction(db, connection => persistStructuredState(connection, getState()))
    }

    hydrated = true
    return getState()
  })()

  try {
    return await hydrationPromise
  }
  catch (error) {
    hydrationPromise = undefined
    throw error
  }
}

async function persistState() {
  const db = getMysqlPool()
  if (!db)
    return
  const pending = persistQueue.then(() => withMysqlTransaction(db, connection => persistStructuredState(connection, getState())))
  persistQueue = pending.then(() => undefined, () => undefined)
  await pending
}

function createProviderConfigs(): GpsProviderConfig[] {
  const tokenConfigured = Boolean(env('GPS_808_TOKEN') || (env('GPS_808_USERNAME') && env('GPS_808_PASSWORD')))
  const monitorUrl = env('GPS_808_MONITOR_URL') || 'https://www.qhzfclw.com/808gps/index.html?lang=zh&isLogin=1&vType=v7'
  if (env('GPS_PROVIDER') !== '808gps' && !tokenConfigured && !monitorUrl)
    return []

  return [
    {
      id: 'provider-808gps',
      provider: '808gps',
      name: '808GPS Provider',
      baseUrl: env('GPS_808_BASE_URL'),
      monitorUrl,
      username: env('GPS_808_USERNAME') ? 'configured' : '',
      enabled: env('GPS_PROVIDER') === '808gps' || Boolean(monitorUrl),
      tokenConfigured,
      createdAt: now(),
      updatedAt: now(),
    },
  ]
}

function createInitialState(): GpsState {
  const createdAt = now()
  return {
    seq: 1000,
    providerConfigs: createProviderConfigs(),
    vehicles: [],
    devices: [],
    binds: [],
    latestLocations: [],
    trackPoints: [],
    alarms: [],
    geofences: [],
    geofenceVehicles: [],
    syncLogs: [],
    operationLogs: [],
  }
}

function getState() {
  if (!globalThis.__gpsState)
    globalThis.__gpsState = createInitialState()
  return globalThis.__gpsState
}

export function resolveGpsProviderName(provider?: GpsProvider) {
  const requested = provider || (env('GPS_PROVIDER') as GpsProvider) || '808gps'
  if (requested !== '808gps')
    throw new Error(`GPS 服务商 ${requested} 未配置`)
  return requested
}

function selectProvider(provider?: GpsProvider) {
  resolveGpsProviderName(provider)
  return create808GpsProvider()
}

function addSyncLog(input: Omit<GpsSyncLog, 'id' | 'startedAt' | 'finishedAt'> & { startedAt?: string }) {
  const state = getState()
  const time = now()
  const log: GpsSyncLog = {
    id: nextId('sync'),
    startedAt: input.startedAt ?? time,
    finishedAt: time,
    provider: input.provider,
    syncType: input.syncType,
    status: input.status,
    message: input.message,
    rawData: input.rawData,
  }
  state.syncLogs.unshift(log)
  return log
}

function addOperationLog(input: Omit<GpsOperationLog, 'id' | 'createdAt'>) {
  const state = getState()
  const log: GpsOperationLog = {
    id: nextId('op'),
    createdAt: now(),
    ...input,
  }
  state.operationLogs.unshift(log)
  return log
}

function withGeofenceVehicles(fence: GpsGeofence) {
  const state = getState()
  return attachGeofenceVehicles(fence, state.geofenceVehicles)
}

function bindToLocation(deviceId: string, payload: LocationPayload, provider: GpsProvider) {
  const state = getState()
  const bind = state.binds.find(item => item.deviceId === deviceId)
  if (!bind)
    return undefined
  const location: GpsLocationLatest = {
    id: state.latestLocations.find(item => item.deviceId === deviceId)?.id ?? nextId('loc'),
    vehicleId: bind.vehicleId,
    deviceId,
    plateNo: bind.plateNo,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed: payload.speed,
    direction: payload.direction,
    altitude: payload.altitude,
    accStatus: payload.accStatus,
    onlineStatus: payload.onlineStatus,
    locationTime: payload.locationTime,
    address: '位置解析中',
    provider,
    rawData: payload.rawData ?? {},
    createdAt: now(),
    updatedAt: now(),
  }
  const index = state.latestLocations.findIndex(item => item.deviceId === deviceId)
  if (index >= 0)
    state.latestLocations[index] = { ...state.latestLocations[index], ...location, createdAt: state.latestLocations[index].createdAt }
  else
    state.latestLocations.push(location)
  return location
}

function normalizeBusinessPlateNo(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[\s·•\-]/g, '')
}

function routeAutoBindingId(geofenceId: string, vehicleId: string) {
  return `route-auto-bind:${createHash('sha1').update(`${geofenceId}:${vehicleId}`).digest('hex')}`
}

export function deriveRouteGeofenceBindings(
  fences: GpsGeofence[],
  vehicles: TransportVehicle[],
) {
  return fences
    .filter(fence => fence.enabled && fence.routeCode)
    .flatMap(fence => vehicles.map(vehicle => ({ geofenceId: fence.id, vehicleId: vehicle.vehicleId })))
}

async function refreshRouteGeofenceVehicleBindings() {
  const state = getState()
  const derived = deriveRouteGeofenceBindings(state.geofences, state.vehicles)
  const manualBindings = state.geofenceVehicles.filter(item => !item.id.startsWith('route-auto-bind:'))
  const manualKeys = new Set(manualBindings.map(item => `${item.geofenceId}:${item.vehicleId}`))
  const autoBindings = derived
    .filter(item => !manualKeys.has(`${item.geofenceId}:${item.vehicleId}`))
    .map(item => ({
      id: routeAutoBindingId(item.geofenceId, item.vehicleId),
      geofenceId: item.geofenceId,
      vehicleId: item.vehicleId,
      createdAt: now(),
    }))
  const previousKeys = state.geofenceVehicles.map(item => `${item.geofenceId}:${item.vehicleId}`).sort()
  const nextBindings = [...manualBindings, ...autoBindings]
  const nextKeys = nextBindings.map(item => `${item.geofenceId}:${item.vehicleId}`).sort()
  if (previousKeys.join('|') === nextKeys.join('|'))
    return
  state.geofenceVehicles = nextBindings
  await persistState()
}

function orderTimestamp(order: Record<string, any>) {
  return String(order.updatedAt || order.shipDate || order.createdAt || order.date || '')
}

export function matchCurrentTransportOrder(plateNo: string, orders: Record<string, any>[]) {
  const normalizedPlateNo = normalizeBusinessPlateNo(plateNo)
  const inactiveStatus = /已完成|已取消|已作废|已关闭|已签收|已回单/
  return orders
    .filter(order => normalizeBusinessPlateNo(order.plateNo || order.vehicleNo) === normalizedPlateNo)
    .filter(order => !inactiveStatus.test(String(order.status || order.orderStatus || '')))
    .sort((a, b) => orderTimestamp(b).localeCompare(orderTimestamp(a)))[0]
}

async function refreshVehicleOrderLinks() {
  const state = getState()
  const { orders } = await transportOperationStore.getDataset()
  let changed = false
  for (const vehicle of state.vehicles) {
    const order = matchCurrentTransportOrder(vehicle.plateNo, orders)
    const next = {
      currentOrderId: order ? String(order.id || order.code || '') : undefined,
      currentOrderNo: order ? String(order.code || order.orderNo || order.id || '') : undefined,
      routeLine: order ? String(order.routeLine || order.routeName || '') : undefined,
      driverName: order?.driver ? String(order.driver) : vehicle.driverName,
    }
    if (vehicle.currentOrderId !== next.currentOrderId || vehicle.currentOrderNo !== next.currentOrderNo || vehicle.routeLine !== next.routeLine || vehicle.driverName !== next.driverName) {
      Object.assign(vehicle, next)
      changed = true
    }
  }
  if (changed)
    await persistState()
}

function filterVehicleIdsByAccess(query: Record<string, any> = {}) {
  const state = getState()
  const role = String(query.role ?? 'USER')
  const userId = query.userId
  if (role === 'ADMIN')
    return state.vehicles.map(item => item.vehicleId)
  return state.vehicles.filter(item => String(item.ownerUserId) === String(userId)).map(item => item.vehicleId)
}

async function syncWithProvider<T>(syncType: GpsSyncLog['syncType'], providerName: GpsProvider | undefined, handler: (adapter: GpsProviderAdapter) => Promise<T>) {
  const startedAt = now()
  const primary = selectProvider(providerName)
  try {
    const data = await handler(primary)
    addSyncLog({ provider: primary.provider, syncType, status: 'success', message: '同步成功', startedAt, rawData: { count: Array.isArray(data) ? data.length : undefined } })
    return { data, provider: primary.provider }
  }
  catch (error: any) {
    addSyncLog({ provider: primary.provider, syncType, status: 'failed', message: error?.message ?? '同步失败', startedAt })
    throw error
  }
}

export const gpsStore = {
  async listProviderConfigs() {
    return (await hydrateState()).providerConfigs
  },
  async listVehicles(query: Record<string, any> = {}) {
    await hydrateState()
    await refreshVehicleOrderLinks()
    const allowedIds = filterVehicleIdsByAccess(query)
    return getState().vehicles.filter(item => allowedIds.includes(item.vehicleId))
  },
  async listDevices() {
    return (await hydrateState()).devices
  },
  async listBinds() {
    return (await hydrateState()).binds
  },
  async listLatestLocations(query: Record<string, any> = {}) {
    await hydrateState()
    const allowedIds = filterVehicleIdsByAccess(query)
    return getState().latestLocations.filter(item => allowedIds.includes(item.vehicleId)).map(withSanitizedAddress)
  },
  async listAlarms(query: Record<string, any> = {}) {
    await hydrateState()
    const allowedIds = filterVehicleIdsByAccess(query)
    return listAlarmRecords(getState().alarms, allowedIds, item => withSanitizedAddress(withNormalizedAlarm(item)))
  },
  async listGeofences() {
    await hydrateState()
    await refreshRouteGeofenceVehicleBindings()
    return getState().geofences.map(withGeofenceVehicles)
  },
  async listSyncLogs() {
    return (await hydrateState()).syncLogs
  },
  async listOperationLogs() {
    return (await hydrateState()).operationLogs
  },
  async syncRouteGeofences(input: {
    routeCode: string
    routeName: string
    loadingAddress: string
    unloadingAddress: string
    loadingCenter?: [number, number]
    unloadingCenter?: [number, number]
    radius?: number
    operatorId?: string | number
    operatorName?: string
  }) {
    await hydrateState()
    const state = getState()
    const radius = input.radius ?? 1500
    if (!input.routeCode.trim() || !input.loadingAddress.trim() || !input.unloadingAddress.trim())
      throw new Error('路线编号、装货地和卸货地不能为空')
    if (!Number.isFinite(radius) || radius <= 0)
      throw new Error('路线围栏半径不合法')

    const definitions = [
      { stage: 'loading' as const, address: input.loadingAddress.trim(), center: input.loadingCenter },
      { stage: 'unloading' as const, address: input.unloadingAddress.trim(), center: input.unloadingCenter },
    ].map((definition) => {
      const existing = state.geofences.find(fence => fence.routeCode === input.routeCode && fence.routeStage === definition.stage)
      const sameAddress = state.geofences.find(fence => fence.shape === 'circle' && fence.address === definition.address && fence.center)
      const center = definition.center ?? existing?.center ?? sameAddress?.center
      if (!center || !isValidLngLat(center))
        throw new Error(`${definition.stage === 'loading' ? '装货地' : '卸货地'}缺少有效经纬度，无法创建电子围栏`)
      return { ...definition, center, existing }
    })

    const timestamp = now()
    const fences = definitions.map((definition) => {
      const name = `${definition.address}${definition.stage === 'loading' ? '装车' : '卸车'}围栏`
      if (definition.existing) {
        Object.assign(definition.existing, { name, address: definition.address, center: definition.center, radius, routeName: input.routeName, enabled: true, updatedAt: timestamp })
        return definition.existing
      }
      const fence: GpsGeofence = {
        id: `route-fence-${input.routeCode}-${definition.stage}`,
        name,
        address: definition.address,
        shape: 'circle',
        center: definition.center,
        radius,
        routeCode: input.routeCode,
        routeName: input.routeName,
        routeStage: definition.stage,
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.geofences.unshift(fence)
      return fence
    })
    addOperationLog({
      action: 'sync-route-geofences',
      operatorId: input.operatorId ?? 'system',
      operatorName: input.operatorName ?? '系统',
      targetType: 'transport_route',
      targetId: input.routeCode,
      message: `同步路线 ${input.routeName} 装卸车电子围栏`,
      rawData: input,
    })
    await refreshRouteGeofenceVehicleBindings()
    await persistState()
    return fences.map(withGeofenceVehicles)
  },
  async syncDevices(provider?: GpsProvider) {
    await hydrateState()
    const result = await syncWithProvider('devices', provider, adapter => adapter.syncDevices())
    const state = getState()
    for (const item of result.data as DevicePayload[]) {
      const current = state.devices.find(device => device.deviceId === item.deviceId || device.deviceNo === item.deviceNo)
      if (current) {
        Object.assign(current, {
          deviceNo: item.deviceNo,
          deviceName: item.deviceName,
          simNo: item.simNo,
          onlineStatus: item.onlineStatus,
          provider: result.provider,
          rawData: item.rawData,
          updatedAt: now(),
        })
      }
      else {
        state.devices.push({
          deviceId: item.deviceId,
          deviceNo: item.deviceNo,
          deviceName: item.deviceName,
          simNo: item.simNo,
          provider: result.provider,
          onlineStatus: item.onlineStatus,
          rawData: item.rawData,
          createdAt: now(),
          updatedAt: now(),
        })
      }

      const providerVehicle = item.rawData?.vehicle as Record<string, any> | undefined
      const plateNo = String(providerVehicle?.nm ?? providerVehicle?.vehiIdno ?? '').trim()
      if (plateNo) {
        const vehicleId = `808gps-${providerVehicle?.id ?? plateNo}`
        let vehicle = state.vehicles.find(vehicle => vehicle.vehicleId === vehicleId || vehicle.plateNo === plateNo)
        if (!vehicle) {
          vehicle = {
            vehicleId,
            plateNo,
            driverId: '',
            driverName: '',
          }
          state.vehicles.push(vehicle)
        }

        const device = state.devices.find(device => device.deviceId === item.deviceId || device.deviceNo === item.deviceNo)
        if (device) {
          const bind = state.binds.find(bind => bind.vehicleId === vehicle!.vehicleId || bind.deviceId === device.deviceId)
          if (bind) {
            bind.vehicleId = vehicle.vehicleId
            bind.deviceId = device.deviceId
            bind.plateNo = plateNo
            bind.provider = result.provider
            bind.updatedAt = now()
          }
          else {
            state.binds.push({
              id: nextId('bind'),
              vehicleId: vehicle.vehicleId,
              deviceId: device.deviceId,
              plateNo,
              provider: result.provider,
              bindTime: now(),
              createdAt: now(),
              updatedAt: now(),
            })
          }
        }
      }
    }
    await persistState()
    return { devices: state.devices, ...result }
  },
  async bindVehicleDevice(input: { vehicleId: string, deviceId: string, provider?: GpsProvider, operatorId?: string | number, operatorName?: string }) {
    await hydrateState()
    const state = getState()
    const vehicle = state.vehicles.find(item => item.vehicleId === input.vehicleId)
    const device = state.devices.find(item => item.deviceId === input.deviceId)
    if (!vehicle)
      throw new Error('车辆不存在')
    if (!device)
      throw new Error('设备不存在')
    const conflicts = state.binds.filter(item => item.vehicleId === input.vehicleId || item.deviceId === input.deviceId)
    const existed = conflicts[0]
    if (existed) {
      existed.vehicleId = vehicle.vehicleId
      existed.deviceId = device.deviceId
      existed.plateNo = vehicle.plateNo
      existed.provider = input.provider ?? device.provider
      existed.updatedAt = now()
      state.binds = state.binds.filter(item => item === existed || (item.vehicleId !== input.vehicleId && item.deviceId !== input.deviceId))
      addOperationLog({
        action: 'bind-device',
        operatorId: input.operatorId ?? 'system',
        operatorName: input.operatorName ?? '系统',
        targetType: 'vehicle_device_bind',
        targetId: existed.id,
        message: `车辆 ${vehicle.plateNo} 绑定设备 ${device.deviceNo}`,
        rawData: input,
      })
      await persistState()
      return existed
    }
    const bind: VehicleDeviceBind = {
      id: nextId('bind'),
      vehicleId: vehicle.vehicleId,
      deviceId: device.deviceId,
      plateNo: vehicle.plateNo,
      provider: input.provider ?? device.provider,
      bindTime: now(),
      createdAt: now(),
      updatedAt: now(),
    }
    state.binds.push(bind)
    addOperationLog({
      action: 'bind-device',
      operatorId: input.operatorId ?? 'system',
      operatorName: input.operatorName ?? '系统',
      targetType: 'vehicle_device_bind',
      targetId: bind.id,
      message: `车辆 ${vehicle.plateNo} 绑定设备 ${device.deviceNo}`,
      rawData: input,
    })
    await persistState()
    return bind
  },
  async syncLatestLocations(provider?: GpsProvider) {
    await hydrateState()
    await refreshRouteGeofenceVehicleBindings()
    const state = getState()
    const deviceIds = state.binds.map(item => item.deviceId)
    const result = await syncWithProvider('latest-location', provider, adapter => adapter.getLatestLocations(deviceIds))
    const locationPayloads = result.data as LocationPayload[]
    const resolvedAddresses = await mapWithConcurrency(locationPayloads, 6, async (item) => {
      const previous = state.latestLocations.find(row => row.deviceId === item.deviceId)
      return validPreviousAddress(item.address)
        ? sanitizeGpsAddress(item.address)
        : resolveAddress(item.longitude, item.latitude, previous?.address)
    })
    const { orders, ...operationData } = await transportOperationStore.getDataset()
    const orderById = new Map(orders.map(order => [String(order.id || order.code || ''), order]))
    let orderStatusChanged = false
    for (const [index, item] of locationPayloads.entries()) {
      const bind = state.binds.find(row => row.deviceId === item.deviceId)
      const previous = state.latestLocations.find(row => row.deviceId === item.deviceId)
      if (previous && !isLocationTimeAfter(item.locationTime, previous.locationTime)) {
        if (shouldRepairGpsAddress(previous.address, resolvedAddresses[index])) {
          previous.address = resolvedAddresses[index]
          previous.updatedAt = now()
        }
        continue
      }
      const current = bindToLocation(item.deviceId, item, result.provider)
      if (!bind)
        continue
      if (!current)
        continue
      current.address = resolvedAddresses[index]
      const boundFenceIds = new Set(state.geofenceVehicles.filter(row => row.vehicleId === bind.vehicleId).map(row => row.geofenceId))
      for (const fence of state.geofences.filter(row => row.enabled && boundFenceIds.has(row.id))) {
        const transition = getTimedGeofenceTransition(
          previous ? { point: [previous.longitude, previous.latitude], locationTime: previous.locationTime } : undefined,
          { point: [current.longitude, current.latitude], locationTime: current.locationTime },
          fence,
        )
        if (!transition)
          continue
        const vehicle = state.vehicles.find(row => row.vehicleId === bind.vehicleId)
        const order = vehicle?.currentOrderId ? orderById.get(vehicle.currentOrderId) : undefined
        if (order) {
          const nextStatus = resolveTransportStatusFromGeofence(String(order.status || ''), fence, transition)
          if (nextStatus !== order.status) {
            order.status = nextStatus
            order.updatedAt = now()
            orderStatusChanged = true
          }
        }
        const alarmTime = current.locationTime || now()
        state.alarms.unshift({
          id: nextId('alarm'),
          vehicleId: bind.vehicleId,
          deviceId: item.deviceId,
          plateNo: bind.plateNo,
          alarmType: transition === 'enter' ? '进入围栏' : '离开围栏',
          alarmLevel: 'medium',
          alarmTime,
          latitude: current.latitude,
          longitude: current.longitude,
          address: sanitizeGpsAddress(current.address),
          speed: current.speed,
          status: 'unhandled',
          provider: result.provider,
          businessType: state.vehicles.find(vehicle => vehicle.vehicleId === bind.vehicleId)?.currentOrderId ? 'transport_order' : 'gps_geofence',
          businessId: state.vehicles.find(vehicle => vehicle.vehicleId === bind.vehicleId)?.currentOrderId || fence.id,
          rawData: { geofenceId: fence.id, geofenceName: fence.name, routeCode: fence.routeCode, routeStage: fence.routeStage, transition },
          createdAt: now(),
          updatedAt: now(),
        })
      }
      const vehicle = state.vehicles.find(row => row.vehicleId === bind.vehicleId)
      const order = vehicle?.currentOrderId ? orderById.get(vehicle.currentOrderId) : undefined
      if (order) {
        const latestFenceAlarm = state.alarms.find(alarm => alarm.vehicleId === bind.vehicleId && alarm.rawData?.routeStage)
        const nextStatus = resolveTransportStatusAtLocation(
          String(order.status || ''),
          [current.longitude, current.latitude],
          state.geofences.filter(fence => fence.enabled && boundFenceIds.has(fence.id)),
          latestFenceAlarm,
        )
        if (nextStatus !== order.status) {
          order.status = nextStatus
          order.updatedAt = now()
          orderStatusChanged = true
        }
      }
    }
    if (orderStatusChanged)
      await transportOperationStore.replaceDataset({ ...operationData, orders })
    await persistState()
    return { locations: state.latestLocations.map(withSanitizedAddress), ...result }
  },
  async getVehicleLocation(vehicleId: string) {
    const location = (await hydrateState()).latestLocations.find(item => item.vehicleId === vehicleId)
    return location ? withSanitizedAddress(location) : undefined
  },
  async getVehicleTrack(vehicleId: string, startTime?: string, endTime?: string, provider?: GpsProvider) {
    await hydrateState()
    const state = getState()
    const bind = state.binds.find(item => item.vehicleId === vehicleId)
    if (!bind)
      throw new Error('车辆未绑定设备')
    const result = await syncWithProvider('tracks', provider, adapter => adapter.getTrack(bind.deviceId, startTime, endTime))
    const currentOrderId = state.vehicles.find(vehicle => vehicle.vehicleId === vehicleId)?.currentOrderId
    const points = await replaceVehicleTrack(state, result.data as LocationPayload[], {
      vehicleId,
      deviceId: bind.deviceId,
      plateNo: bind.plateNo,
      currentOrderId,
      provider: result.provider,
    }, {
      nextLocationId: () => nextId('loc'),
      nextTrackId: () => nextId('track'),
      now,
      resolveAddress,
    })
    await persistState()
    return { points, ...result }
  },
  async syncAlarms(provider?: GpsProvider) {
    await hydrateState()
    const state = getState()
    const deviceIds = state.binds.map(item => item.deviceId)
    const result = await syncWithProvider('alarms', provider, adapter => adapter.syncAlarms(deviceIds))
    await mergeSyncedAlarms(state, result.data as AlarmPayload[], result.provider, {
      nextId: () => nextId('alarm'),
      now,
      resolveAddress,
    })
    await persistState()
    return { alarms: state.alarms.map(withNormalizedAlarm).map(withSanitizedAddress), ...result }
  },
  async handleAlarm(input: { alarmId: string, status: AlarmStatus, handleRemark?: string, operatorId?: string | number, operatorName?: string }) {
    await hydrateState()
    const state = getState()
    const { alarm, operation } = handleAlarmRecord(state.alarms, input, now())
    addOperationLog(operation)
    await persistState()
    return alarm
  },
  async upsertGeofence(input: Partial<GpsGeofence> & { operatorId?: string | number, operatorName?: string }) {
    await hydrateState()
    const state = getState()
    const { fence, operation } = saveGeofence(state, input, { nextId: () => nextId('fence'), now })
    addOperationLog(operation)
    await persistState()
    return fence
  },
  async bindGeofenceVehicles(input: { geofenceId: string, vehicleIds: string[], operatorId?: string | number, operatorName?: string }) {
    await hydrateState()
    const state = getState()
    const { fence, operation } = bindGeofenceVehicles(state, input, { nextId: () => nextId('fence-bind'), now })
    addOperationLog(operation)
    await persistState()
    return fence
  },
  async getVehicleStatuses() {
    await hydrateState()
    await refreshVehicleOrderLinks()
    const state = getState()
    return state.vehicles.map((vehicle) => {
      const location = state.latestLocations.find(item => item.vehicleId === vehicle.vehicleId)
      const bind = state.binds.find(item => item.vehicleId === vehicle.vehicleId)
      return {
        ...vehicle,
        deviceId: bind?.deviceId,
        onlineStatus: location?.onlineStatus ?? 'unknown',
        speed: location?.speed ?? 0,
        locationTime: location?.locationTime,
      }
    })
  },
  async getMapData(query: Record<string, any> = {}) {
    await hydrateState()
    await refreshRouteGeofenceVehicleBindings()
    const state = getState()
    const allowedIds = filterVehicleIdsByAccess(query)
    const statuses = await this.getVehicleStatuses()
    return {
      vehicles: statuses.filter(item => allowedIds.includes(item.vehicleId)),
      locations: state.latestLocations.filter(item => allowedIds.includes(item.vehicleId)).map(withSanitizedAddress),
      tracks: state.trackPoints.filter(item => allowedIds.includes(item.vehicleId)),
      alarms: state.alarms.filter(item => allowedIds.includes(item.vehicleId)).map(withNormalizedAlarm).map(withSanitizedAddress),
      geofences: state.geofences.map(withGeofenceVehicles).map(fence => ({
        ...fence,
        vehicles: fence.vehicles?.filter(item => allowedIds.includes(item.vehicleId)),
      })),
      binds: state.binds.filter(item => allowedIds.includes(item.vehicleId)),
    }
  },
}

export type {
  AccStatus,
  AlarmStatus,
  GpsProvider,
  OnlineStatus,
}
