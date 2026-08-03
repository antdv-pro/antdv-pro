import type { GpsAlarmPayload, GpsProvider } from '../../services/gps/providers/types'

export interface AlarmRecord {
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
  status: 'unhandled' | 'handled' | 'ignored'
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

interface AlarmState {
  alarms: AlarmRecord[]
  binds: Array<{ deviceId: string, vehicleId: string, plateNo: string }>
  vehicles: Array<{ vehicleId: string, currentOrderId?: string }>
  latestLocations: Array<{ vehicleId: string, address?: string }>
}

export interface HandleAlarmInput {
  alarmId: string
  status: AlarmRecord['status']
  handleRemark?: string
  operatorId?: string | number
  operatorName?: string
}

export function listAlarmRecords<T extends AlarmRecord>(alarms: T[], allowedVehicleIds: readonly string[], normalize: (alarm: T) => T) {
  const allowed = new Set(allowedVehicleIds)
  return alarms.filter(item => allowed.has(item.vehicleId)).map(normalize)
}

export async function mergeSyncedAlarms(
  state: AlarmState,
  payloads: GpsAlarmPayload[],
  provider: GpsProvider,
  dependencies: {
    nextId: () => string
    now: () => string
    resolveAddress: (longitude: number, latitude: number, previousAddress?: string) => Promise<string>
  },
) {
  for (const item of payloads) {
    const bind = state.binds.find(row => row.deviceId === item.deviceId)
    if (!bind)
      continue
    const previousAddress = state.latestLocations.find(location => location.vehicleId === bind.vehicleId)?.address
    const existed = state.alarms.find(alarm => alarm.deviceId === item.deviceId && alarm.alarmTime === item.alarmTime && alarm.alarmType === item.alarmType)
    if (existed) {
      if (!existed.address && (item.latitude !== 0 || item.longitude !== 0))
        existed.address = await dependencies.resolveAddress(item.longitude, item.latitude, previousAddress)
      continue
    }
    const vehicle = state.vehicles.find(row => row.vehicleId === bind.vehicleId)
    const address = item.latitude !== 0 || item.longitude !== 0
      ? await dependencies.resolveAddress(item.longitude, item.latitude, previousAddress)
      : ''
    const timestamp = dependencies.now()
    state.alarms.unshift({
      id: dependencies.nextId(),
      vehicleId: bind.vehicleId,
      deviceId: item.deviceId,
      plateNo: bind.plateNo,
      alarmType: item.alarmType,
      alarmLevel: item.alarmLevel,
      alarmTime: item.alarmTime,
      latitude: item.latitude,
      longitude: item.longitude,
      address,
      speed: item.speed,
      status: 'unhandled',
      handleRemark: '',
      provider,
      businessType: vehicle?.currentOrderId ? 'transport_order' : undefined,
      businessId: vehicle?.currentOrderId,
      rawData: item.rawData ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
}

export function handleAlarmRecord(alarms: AlarmRecord[], input: HandleAlarmInput, timestamp: string) {
  const alarm = alarms.find(item => item.id === input.alarmId)
  if (!alarm)
    throw new Error('报警记录不存在')
  if (!['unhandled', 'handled', 'ignored'].includes(input.status))
    throw new Error('报警处理状态不合法')
  alarm.status = input.status
  alarm.handleRemark = input.handleRemark
  alarm.handledBy = input.operatorName ?? '系统'
  alarm.handledAt = timestamp
  alarm.updatedAt = timestamp
  return {
    alarm,
    operation: {
      action: 'handle-alarm',
      operatorId: input.operatorId ?? 'system',
      operatorName: input.operatorName ?? '系统',
      targetType: 'gps_alarm_record',
      targetId: alarm.id,
      message: `处理 ${alarm.plateNo} ${alarm.alarmType}: ${input.handleRemark ?? ''}`,
      rawData: input,
    },
  }
}
