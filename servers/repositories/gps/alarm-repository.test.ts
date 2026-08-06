import { describe, expect, it, vi } from 'vitest'
import { handleAlarmRecord, listAlarmRecords, mergeSyncedAlarms } from './alarm-repository'

const timestamp = '2026-07-18T00:00:00.000Z'
function alarm(overrides: Record<string, any> = {}) {
  return {
    id: 'A1',
    vehicleId: 'V1',
    deviceId: 'D1',
    plateNo: '青A001',
    alarmType: '超速',
    alarmLevel: 'high' as const,
    alarmTime: timestamp,
    latitude: 36,
    longitude: 94,
    speed: 100,
    status: 'unhandled' as const,
    provider: '808gps' as const,
    rawData: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

describe('gPS alarm repository', () => {
  it('filters by accessible vehicle before normalizing', () => {
    const normalize = vi.fn(item => ({ ...item, address: '已净化' }))
    const result = listAlarmRecords([alarm(), alarm({ id: 'A2', vehicleId: 'V2' })], ['V1'], normalize)
    expect(result).toEqual([expect.objectContaining({ id: 'A1', address: '已净化' })])
    expect(normalize).toHaveBeenCalledTimes(1)
  })

  it('deduplicates provider alarms and repairs a missing address', async () => {
    const state = {
      alarms: [alarm({ address: '' })],
      binds: [{ deviceId: 'D1', vehicleId: 'V1', plateNo: '青A001' }],
      vehicles: [{ vehicleId: 'V1', currentOrderId: 'O1' }],
      latestLocations: [{ vehicleId: 'V1', address: '旧地址' }],
    }
    const resolveAddress = vi.fn().mockResolvedValue('新地址')
    await mergeSyncedAlarms(state, [{ deviceId: 'D1', alarmType: '超速', alarmLevel: 'high', alarmTime: timestamp, latitude: 36, longitude: 94, speed: 100 }], '808gps', {
      nextId: () => 'A2',
      now: () => timestamp,
      resolveAddress,
    })
    expect(state.alarms).toHaveLength(1)
    expect(state.alarms[0].address).toBe('新地址')
    expect(resolveAddress).toHaveBeenCalledWith(94, 36, '旧地址')
  })

  it('creates a business-linked alarm for a bound device', async () => {
    const state = {
      alarms: [] as ReturnType<typeof alarm>[],
      binds: [{ deviceId: 'D1', vehicleId: 'V1', plateNo: '青A001' }],
      vehicles: [{ vehicleId: 'V1', currentOrderId: 'O1' }],
      latestLocations: [],
    }
    await mergeSyncedAlarms(state, [{ deviceId: 'D1', alarmType: '设备离线', alarmLevel: 'medium', alarmTime: timestamp, latitude: 0, longitude: 0, speed: 0 }], '808gps', {
      nextId: () => 'A2',
      now: () => timestamp,
      resolveAddress: vi.fn(),
    })
    expect(state.alarms[0]).toMatchObject({ id: 'A2', vehicleId: 'V1', businessType: 'transport_order', businessId: 'O1' })
  })

  it('validates handling and returns an audit operation', () => {
    const alarms = [alarm()]
    const result = handleAlarmRecord(alarms, { alarmId: 'A1', status: 'handled', operatorName: '调度员' }, timestamp)
    expect(result.alarm).toMatchObject({ status: 'handled', handledBy: '调度员', handledAt: timestamp })
    expect(result.operation).toMatchObject({ action: 'handle-alarm', targetId: 'A1' })
    expect(() => handleAlarmRecord(alarms, { alarmId: 'missing', status: 'handled' }, timestamp)).toThrow('报警记录不存在')
  })
})
