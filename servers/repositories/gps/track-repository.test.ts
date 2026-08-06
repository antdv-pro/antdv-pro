import { describe, expect, it, vi } from 'vitest'
import { replaceVehicleTrack } from './track-repository'

const timestamp = '2026-07-18T00:00:00.000Z'
const payload = {
  deviceId: 'D1',
  latitude: 36.4,
  longitude: 94.9,
  speed: 20,
  direction: 90,
  altitude: 2800,
  accStatus: 'on' as const,
  onlineStatus: 'online' as const,
  locationTime: timestamp,
  rawData: {},
}

describe('gPS track repository', () => {
  it('preserves the previous address while replacing latest location and vehicle tracks', async () => {
    const state = {
      latestLocations: [{
        id: 'L1',
        vehicleId: 'V1',
        deviceId: 'D1',
        plateNo: '青A001',
        address: '最后已知地址',
        provider: '808gps' as const,
        ...payload,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      }],
      trackPoints: [{
        id: 'OLD',
        vehicleId: 'V1',
        deviceId: 'D1',
        plateNo: '青A001',
        address: '旧轨迹',
        provider: '808gps' as const,
        ...payload,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }
    const resolveAddress = vi.fn().mockResolvedValue('解析后地址')
    const points = await replaceVehicleTrack(state, [payload], {
      vehicleId: 'V1',
      deviceId: 'D1',
      plateNo: '青A001',
      currentOrderId: 'O1',
      provider: '808gps',
    }, {
      nextLocationId: () => 'L2',
      nextTrackId: () => 'T1',
      now: () => timestamp,
      resolveAddress,
    })

    expect(resolveAddress).toHaveBeenCalledWith(94.9, 36.4, '最后已知地址')
    expect(state.latestLocations[0]).toMatchObject({ id: 'L1', address: '位置解析中', createdAt: '2026-07-01T00:00:00.000Z' })
    expect(points[0]).toMatchObject({ id: 'T1', address: '解析后地址', businessType: 'transport_order', businessId: 'O1' })
    expect(state.trackPoints.map(item => item.id)).toEqual(['T1'])
  })

  it('keeps other vehicles tracks and creates a latest-location identity', async () => {
    const state = {
      latestLocations: [],
      trackPoints: [{
        ...payload,
        id: 'T2',
        vehicleId: 'V2',
        deviceId: 'D2',
        plateNo: '青A002',
        address: '地址',
        provider: '808gps' as const,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }
    await replaceVehicleTrack(state, [payload], {
      vehicleId: 'V1',
      deviceId: 'D1',
      plateNo: '青A001',
      provider: '808gps',
    }, {
      nextLocationId: () => 'L1',
      nextTrackId: () => 'T1',
      now: () => timestamp,
      resolveAddress: vi.fn().mockResolvedValue('地址'),
    })
    expect(state.latestLocations[0].id).toBe('L1')
    expect(state.trackPoints.map(item => item.id)).toEqual(['T2', 'T1'])
  })
})
