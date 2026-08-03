import { describe, expect, it } from 'vitest'
import { bindGeofenceVehicles, saveGeofence } from './geofence-repository'

const timestamp = '2026-07-18T00:00:00.000Z'
const dependencies = { nextId: () => 'F1', now: () => timestamp }
function state() {
  return {
    geofences: [] as any[],
    geofenceVehicles: [] as any[],
    vehicles: [{ vehicleId: 'V1' }, { vehicleId: 'V2' }],
  }
}

describe('gPS geofence repository', () => {
  it('creates and updates a validated circle with audit operations', () => {
    const data = state()
    const created = saveGeofence(data, { name: '园区', shape: 'circle', center: [94, 36], radius: 500 }, dependencies)
    expect(created.fence).toMatchObject({ id: 'F1', name: '园区', center: [94, 36], radius: 500 })
    expect(created.operation.action).toBe('create-geofence')
    const updated = saveGeofence(data, { id: 'F1', name: '新园区', radius: 800 }, dependencies)
    expect(updated.fence).toMatchObject({ name: '新园区', radius: 800 })
    expect(updated.operation.action).toBe('update-geofence')
  })

  it('rejects invalid circle and polygon geometry', () => {
    expect(() => saveGeofence(state(), { shape: 'circle', center: [181, 36] }, dependencies)).toThrow('中心坐标不合法')
    expect(() => saveGeofence(state(), { shape: 'circle', center: [94, 36], radius: 0 }, dependencies)).toThrow('半径必须大于 0')
    expect(() => saveGeofence(state(), { shape: 'polygon', points: [[94, 36], [95, 36]] }, dependencies)).toThrow('至少需要 3 个有效坐标点')
  })

  it('deduplicates vehicle bindings and replaces previous bindings', () => {
    const data = state()
    saveGeofence(data, { name: '园区' }, dependencies)
    data.geofenceVehicles.push({ id: 'OLD', geofenceId: 'F1', vehicleId: 'V2', createdAt: timestamp })
    let sequence = 0
    const result = bindGeofenceVehicles(data, { geofenceId: 'F1', vehicleIds: ['V1', 'V1'] }, {
      nextId: () => `B${++sequence}`,
      now: () => timestamp,
    })
    expect(result.fence.vehicles).toEqual([{ id: 'B1', geofenceId: 'F1', vehicleId: 'V1', createdAt: timestamp }])
    expect(result.operation).toMatchObject({ action: 'bind-geofence-vehicles', targetId: 'F1' })
  })

  it('rejects missing fences and unknown vehicles', () => {
    expect(() => bindGeofenceVehicles(state(), { geofenceId: 'missing', vehicleIds: [] }, dependencies)).toThrow('电子围栏不存在')
    const data = state()
    saveGeofence(data, { name: '园区' }, dependencies)
    expect(() => bindGeofenceVehicles(data, { geofenceId: 'F1', vehicleIds: ['V9'] }, dependencies)).toThrow('包含不存在的车辆')
  })
})
