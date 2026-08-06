import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { validPreviousAddress } from '../services/gps/reverse-geocoding-adapter'
import { deriveRouteGeofenceBindings, fallbackGpsLocation, formatGpsLocation, formatPhotonLocation, gpsStore, matchCurrentTransportOrder, mergeReverseGeocodeLocation, resolve808GpsCoordinates, resolveGpsProviderName, resolveTransportStatusAtLocation, resolveTransportStatusFromGeofence, sanitizeGpsAddress, shouldRepairGpsAddress } from './gps-store'

vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))

afterEach(() => vi.unstubAllEnvs())

const createdAt = '2026-07-01T00:00:00.000Z'

function resetGpsState() {
  ;(globalThis as any).__gpsState = {
    seq: 1000,
    providerConfigs: [],
    vehicles: [
      { vehicleId: 'V1', plateNo: '青A001', driverId: 'D1', driverName: '张三', ownerUserId: 7, currentOrderId: 'O1' },
      { vehicleId: 'V2', plateNo: '青A002', driverId: 'D2', driverName: '李四', ownerUserId: 8 },
    ],
    devices: [
      { deviceId: 'D1', deviceNo: 'DEV1', deviceName: '设备1', provider: '808gps', onlineStatus: 'online', createdAt, updatedAt: createdAt },
      { deviceId: 'D2', deviceNo: 'DEV2', deviceName: '设备2', provider: '808gps', onlineStatus: 'offline', createdAt, updatedAt: createdAt },
    ],
    binds: [
      { id: 'B1', vehicleId: 'V1', deviceId: 'D1', plateNo: '青A001', provider: '808gps', bindTime: createdAt, createdAt, updatedAt: createdAt },
      { id: 'B2', vehicleId: 'V2', deviceId: 'D2', plateNo: '青A002', provider: '808gps', bindTime: createdAt, createdAt, updatedAt: createdAt },
    ],
    latestLocations: [
      { id: 'L1', vehicleId: 'V1', deviceId: 'D1', plateNo: '青A001', latitude: 36.4, longitude: 94.9, speed: 20, direction: 0, altitude: 0, accStatus: 'on', onlineStatus: 'online', locationTime: createdAt, address: '测试', provider: '808gps', rawData: {}, createdAt, updatedAt: createdAt },
    ],
    trackPoints: [],
    alarms: [
      { id: 'A1', vehicleId: 'V1', deviceId: 'D1', plateNo: '青A001', alarmType: '超速', alarmLevel: 'high', alarmTime: createdAt, latitude: 36.4, longitude: 94.9, speed: 100, status: 'unhandled', provider: '808gps', rawData: {}, createdAt, updatedAt: createdAt },
    ],
    geofences: [],
    geofenceVehicles: [],
    syncLogs: [],
    operationLogs: [],
  }
}

describe('gPS store memory operations', () => {
  beforeEach(() => resetGpsState())

  it('filters vehicles, locations and alarms by ownership', async () => {
    expect(await gpsStore.listVehicles({ role: 'USER', userId: 7 })).toEqual([expect.objectContaining({ vehicleId: 'V1' })])
    expect(await gpsStore.listLatestLocations({ role: 'USER', userId: 8 })).toEqual([])
    expect(await gpsStore.listAlarms({ role: 'USER', userId: 7 })).toHaveLength(1)
    expect(await gpsStore.listVehicles({ role: 'ADMIN' })).toHaveLength(2)
  })

  it('validates bind resources and consolidates two conflicting bindings', async () => {
    await expect(gpsStore.bindVehicleDevice({ vehicleId: 'missing', deviceId: 'D1' })).rejects.toThrow('车辆不存在')
    await expect(gpsStore.bindVehicleDevice({ vehicleId: 'V1', deviceId: 'missing' })).rejects.toThrow('设备不存在')
    const bind = await gpsStore.bindVehicleDevice({ vehicleId: 'V1', deviceId: 'D2', operatorId: 1, operatorName: '管理员' })
    expect(bind).toMatchObject({ vehicleId: 'V1', deviceId: 'D2', plateNo: '青A001' })
    expect(await gpsStore.listBinds()).toEqual([expect.objectContaining({ vehicleId: 'V1', deviceId: 'D2' })])
    expect(await gpsStore.listOperationLogs()).toEqual([expect.objectContaining({ action: 'bind-device', operatorName: '管理员' })])
  })

  it('validates alarm states and records handling metadata', async () => {
    await expect(gpsStore.handleAlarm({ alarmId: 'missing', status: 'handled' })).rejects.toThrow('报警记录不存在')
    await expect(gpsStore.handleAlarm({ alarmId: 'A1', status: 'bad' as any })).rejects.toThrow('报警处理状态不合法')
    const alarm = await gpsStore.handleAlarm({ alarmId: 'A1', status: 'handled', handleRemark: '已联系司机', operatorName: '调度员' })
    expect(alarm).toMatchObject({ status: 'handled', handleRemark: '已联系司机', handledBy: '调度员' })
  })

  it('normalizes provider alarm reasons and nested GPS coordinates', async () => {
    ;(globalThis as any).__gpsState.alarms[0].alarmType = '青A001'
    ;(globalThis as any).__gpsState.alarms[0].latitude = 0
    ;(globalThis as any).__gpsState.alarms[0].longitude = 0
    ;(globalThis as any).__gpsState.alarms[0].rawData = {
      type: 67,
      desc: '青A001',
      Gps: { mlat: '33.132123', mlng: '106.694550', sp: 0 },
    }

    const [alarm] = await gpsStore.listAlarms({ role: 'ADMIN' })
    expect(alarm).toMatchObject({
      alarmType: '设备离线',
      latitude: 33.132123,
      longitude: 106.69455,
    })
  })

  it('validates circle and polygon geofence geometry', async () => {
    await expect(gpsStore.upsertGeofence({ name: '坏圆', shape: 'circle', center: [Number.NaN, 1], radius: 100 })).rejects.toThrow('中心坐标不合法')
    await expect(gpsStore.upsertGeofence({ name: '越界坐标', shape: 'circle', center: [181, 36], radius: 100 })).rejects.toThrow('中心坐标不合法')
    await expect(gpsStore.upsertGeofence({ name: '坏半径', shape: 'circle', center: [94, 36], radius: 0 })).rejects.toThrow('半径必须大于 0')
    await expect(gpsStore.upsertGeofence({ name: '坏多边形', shape: 'polygon', points: [[94, 36], [95, 36]] })).rejects.toThrow('至少需要 3 个有效坐标点')
    const circle = await gpsStore.upsertGeofence({ name: '园区', shape: 'circle', center: [94, 36], radius: 500, routeCode: 'LX0001', routeName: '测试路线', routeStage: 'loading' })
    const polygon = await gpsStore.upsertGeofence({ name: '线路', shape: 'polygon', points: [[94, 36], [95, 36], [95, 37]] })
    expect([circle.shape, polygon.shape]).toEqual(['circle', 'polygon'])
    expect(circle).toMatchObject({ routeCode: 'LX0001', routeName: '测试路线', routeStage: 'loading' })
    await expect(gpsStore.upsertGeofence({ id: 'missing', name: '无效' })).rejects.toThrow('电子围栏不存在')
  })

  it('validates and deduplicates geofence vehicle bindings', async () => {
    const fence = await gpsStore.upsertGeofence({ name: '园区', shape: 'circle', center: [94, 36], radius: 500 })
    await expect(gpsStore.bindGeofenceVehicles({ geofenceId: 'missing', vehicleIds: ['V1'] })).rejects.toThrow('电子围栏不存在')
    await expect(gpsStore.bindGeofenceVehicles({ geofenceId: fence.id, vehicleIds: ['V9'] })).rejects.toThrow('包含不存在的车辆')
    const result = await gpsStore.bindGeofenceVehicles({ geofenceId: fence.id, vehicleIds: ['V1', 'V1', 'V2'] })
    expect(result.vehicles.map(item => item.vehicleId)).toEqual(['V1', 'V2'])
  })

  it('creates and updates loading and unloading fences for a route', async () => {
    const fences = await gpsStore.syncRouteGeofences({
      routeCode: 'LX001',
      routeName: '液厂-加气站',
      loadingAddress: '液厂',
      unloadingAddress: '加气站',
      loadingCenter: [94.9, 36.4],
      unloadingCenter: [95.1, 36.5],
    })
    expect(fences).toEqual(expect.arrayContaining([
      expect.objectContaining({ routeCode: 'LX001', routeStage: 'loading', address: '液厂', radius: 1500 }),
      expect.objectContaining({ routeCode: 'LX001', routeStage: 'unloading', address: '加气站', radius: 1500 }),
    ]))
    const updated = await gpsStore.syncRouteGeofences({
      routeCode: 'LX001',
      routeName: '液厂-新站',
      loadingAddress: '液厂',
      unloadingAddress: '新站',
      unloadingCenter: [95.2, 36.6],
    })
    expect(updated).toHaveLength(2)
    expect((globalThis as any).__gpsState.geofences).toHaveLength(2)
    expect(updated.find(item => item.routeStage === 'unloading')).toMatchObject({ address: '新站', center: [95.2, 36.6] })
  })

  it('rejects route fence creation when a stop has no reusable coordinates', async () => {
    await expect(gpsStore.syncRouteGeofences({
      routeCode: 'LX002',
      routeName: '未知路线',
      loadingAddress: '未知装货地',
      unloadingAddress: '未知卸货地',
    })).rejects.toThrow('装货地缺少有效经纬度')
    expect((globalThis as any).__gpsState.geofences).toHaveLength(0)
  })

  it('builds vehicle statuses and access-filtered map data', async () => {
    expect(await gpsStore.getVehicleLocation('V1')).toMatchObject({ speed: 20 })
    expect(await gpsStore.getVehicleStatuses()).toEqual(expect.arrayContaining([
      expect.objectContaining({ vehicleId: 'V1', onlineStatus: 'online', speed: 20 }),
      expect.objectContaining({ vehicleId: 'V2', onlineStatus: 'unknown', speed: 0 }),
    ]))
    const map = await gpsStore.getMapData({ role: 'USER', userId: 7 })
    expect(map.vehicles.map(item => item.vehicleId)).toEqual(['V1'])
    expect(map.alarms).toHaveLength(1)
  })

  it('rejects track lookup for vehicles without a device binding', async () => {
    ;(globalThis as any).__gpsState.binds = []
    await expect(gpsStore.getVehicleTrack('V1')).rejects.toThrow('车辆未绑定设备')
  })
})

describe('route geofence vehicle bindings', () => {
  it('binds every GPS vehicle to each enabled route fence', () => {
    const fences = [
      { id: 'F1', name: '装车围栏', shape: 'circle' as const, routeCode: 'LX001', routeName: '格尔木至宁强', enabled: true, createdAt, updatedAt: createdAt },
      { id: 'F2', name: '卸车围栏', shape: 'circle' as const, routeCode: 'LX001', routeName: '格尔木至宁强', enabled: false, createdAt, updatedAt: createdAt },
    ]
    const vehicles = [
      { vehicleId: 'V1', plateNo: '青A·001', driverId: 'D1', driverName: '张三' },
      { vehicleId: 'V2', plateNo: '青A·002', driverId: 'D2', driverName: '李四' },
    ]
    expect(deriveRouteGeofenceBindings(fences, vehicles)).toEqual([
      { geofenceId: 'F1', vehicleId: 'V1' },
      { geofenceId: 'F1', vehicleId: 'V2' },
    ])
  })
})

describe('transport status from geofence transitions', () => {
  const loadingFence = { id: 'F-LOAD', name: '液厂装车围栏', routeStage: 'loading' as const }
  const unloadingFence = { id: 'F-UNLOAD', name: '加气站卸车围栏', routeStage: 'unloading' as const }
  const parkingFence = { id: 'fence-company-parking', name: '公司停车场' }

  it('maps route-node and company-parking transitions to transport statuses', () => {
    expect(resolveTransportStatusFromGeofence('', loadingFence, 'enter')).toBe('装车')
    expect(resolveTransportStatusFromGeofence('装车', loadingFence, 'exit')).toBe('运输中')
    expect(resolveTransportStatusFromGeofence('运输中', unloadingFence, 'enter')).toBe('卸车')
    expect(resolveTransportStatusFromGeofence('运输中', unloadingFence, 'exit')).toBe('空返')
    expect(resolveTransportStatusFromGeofence('空返', parkingFence, 'enter')).toBe('空返')
  })

  it('classifies the current location before falling back to the latest fence event', () => {
    const fences = [
      { ...loadingFence, shape: 'circle' as const, center: [94, 36] as [number, number], radius: 1500, enabled: true, createdAt, updatedAt: createdAt },
      { ...unloadingFence, shape: 'circle' as const, center: [95, 37] as [number, number], radius: 1500, enabled: true, createdAt, updatedAt: createdAt },
    ]
    expect(resolveTransportStatusAtLocation('运输中', [94, 36], fences)).toBe('装车')
    expect(resolveTransportStatusAtLocation('运输中', [95, 37], fences)).toBe('卸车')
    expect(resolveTransportStatusAtLocation('装车', [94.5, 36.5], fences, { rawData: { routeStage: 'loading', transition: 'exit' } })).toBe('运输中')
    expect(resolveTransportStatusAtLocation('卸车', [94.5, 36.5], fences, { rawData: { routeStage: 'unloading', transition: 'exit' } })).toBe('空返')
    expect(resolveTransportStatusAtLocation('装车', [94.5, 36.5], fences)).toBe('运输中')
    expect(resolveTransportStatusAtLocation('卸车', [94.5, 36.5], fences)).toBe('空返')
    expect(resolveTransportStatusAtLocation('待审核', [94.5, 36.5], fences)).toBe('运输中')
    expect(resolveTransportStatusAtLocation('已通过', [94.5, 36.5], fences)).toBe('运输中')
  })
})

describe('808GPS coordinate normalization', () => {
  it('prefers provider map coordinates to stay aligned with the 808GPS monitor', () => {
    expect(resolve808GpsCoordinates({
      lat: 29648385,
      lng: 91020225,
      mlat: '29.651289',
      mlng: '91.028239',
    })).toEqual({ latitude: 29.651289, longitude: 91.028239 })
  })

  it('falls back to raw coordinates when provider map coordinates are absent', () => {
    expect(resolve808GpsCoordinates({ lat: 36373386, lng: 95014796 }))
      .toEqual({ latitude: 36.373386, longitude: 95.014796 })
  })
})

describe('gPS location formatting', () => {
  it('falls back to coordinates when reverse geocoding is unavailable', () => {
    expect(fallbackGpsLocation('位置解析中', 94.960192, 36.384169)).toBe('94.960192, 36.384169')
  })

  it('does not concatenate conflicting cities returned by two geocoders', () => {
    expect(mergeReverseGeocodeLocation('北京市', '昆明市 官渡区')).toBe('昆明市 官渡区')
    expect(mergeReverseGeocodeLocation('昆明市', '昆明市 官渡区')).toBe('昆明市 官渡区')
  })

  it('removes isolated distant city aliases from an otherwise consistent address', () => {
    expect(mergeReverseGeocodeLocation('汉中市', '汉中市 勉县 定军山镇 北京 昆明'))
      .toBe('汉中市 勉县 定军山镇')
    expect(mergeReverseGeocodeLocation('北京市', '北京市 朝阳区 北京路'))
      .toBe('北京市 朝阳区 北京路')
  })

  it('cleans previously cached GPS addresses', () => {
    expect(sanitizeGpsAddress('汉中市 勉县 定军山镇 北京 昆明')).toBe('汉中市 勉县 定军山镇')
    expect(fallbackGpsLocation('汉中市 勉县 定军山镇 北京 昆明')).toBe('汉中市 勉县 定军山镇')
    expect(sanitizeGpsAddress('定军山镇 勉县 北京 - 昆明')).toBe('定军山镇 勉县')
    expect(fallbackGpsLocation('定军山镇 勉县 北京 - 昆明')).toBe('定军山镇 勉县')
  })

  it('removes the Qinghai and Haixi prefix from Golmud locations', () => {
    const address = '青海省海西蒙古族藏族自治州格尔木市察尔汗行政委员会G215中国石油昆仑能源青海公司察尔汗LNG加气站西南17米'
    expect(sanitizeGpsAddress(address))
      .toBe('格尔木市察尔汗行政委员会G215中国石油昆仑能源青海公司察尔汗LNG加气站西南17米')
  })

  it('cleans cached addresses returned by GPS list APIs', async () => {
    ;(globalThis as any).__gpsState.latestLocations[0].address = '汉中市 勉县 定军山镇 北京 昆明'
    const location = await gpsStore.getVehicleLocation('V1')
    expect(location?.address).toBe('汉中市 勉县 定军山镇')
  })

  it('shows only the most specific location in simplified Chinese', () => {
    expect(formatGpsLocation({
      principalSubdivision: '陕西省',
      city: '汉中市',
      locality: '勉縣',
    })).toBe('勉县')
  })

  it('falls back to the most specific administrative division', () => {
    expect(formatGpsLocation({
      localityInfo: {
        administrative: [
          { name: '西藏自治區', adminLevel: 4 },
          { name: '林芝市', adminLevel: 5 },
          { name: '波密縣', adminLevel: 6 },
          { name: '扎木鎮', adminLevel: 8 },
        ],
      },
    })).toBe('扎木镇')
  })

  it('includes city, county and the concrete village without province', () => {
    expect(formatPhotonLocation({
      features: [{
        properties: {
          name: '銅錢壩',
          city: '漢中市',
          county: '勉縣',
          state: '陝西省',
          country: '中國',
        },
      }],
    })).toBe('汉中市 勉县 铜钱坝')
  })

  it('deduplicates concrete road or landmark names', () => {
    expect(formatPhotonLocation({
      features: [{ properties: { county: '格爾木市', locality: '察爾汗', street: '柳格高速', name: '柳格高速' } }],
    })).toBe('格尔木市 察尔汗 柳格高速')
  })

  it('does not include non-Chinese alternate-script labels', () => {
    expect(formatPhotonLocation({
      features: [{ properties: { city: '拉萨市', county: '堆龙德庆区', name: 'ལྷ་ས།' } }],
    })).toBe('拉萨市 堆龙德庆区')
  })

  it('keeps the last known business location when geocoding fails', () => {
    expect(fallbackGpsLocation('勉县 铜钱坝')).toBe('勉县 铜钱坝')
    expect(fallbackGpsLocation('勉县 铜钱坝（最后已知）')).toBe('勉县 铜钱坝')
  })

  it('never exposes unavailable or coordinate placeholders as a location', () => {
    expect(fallbackGpsLocation('位置暂不可用')).toBe('定位信息待更新')
    expect(fallbackGpsLocation('精确坐标：33.1, 106.4')).toBe('定位信息待更新')
  })

  it('repairs an unresolved address even when the positioning time is unchanged', () => {
    expect(shouldRepairGpsAddress('位置解析中', '汉中市 勉县 铜钱坝')).toBe(true)
    expect(shouldRepairGpsAddress('定位信息待更新', '汉中市 勉县 铜钱坝')).toBe(true)
    expect(shouldRepairGpsAddress('汉中市 勉县 铜钱坝', '汉中市 勉县 定军山镇')).toBe(false)
  })

  it('recognizes usable provider addresses before reverse geocoding', () => {
    expect(validPreviousAddress('汉中市 勉县 铜钱坝')).toBe('汉中市 勉县 铜钱坝')
    expect(validPreviousAddress('位置解析中')).toBe('')
  })
})

describe('gPS transport order matching', () => {
  it('matches normalized plate numbers and ignores completed orders', () => {
    const order = matchCurrentTransportOrder('云A·12345', [
      { code: 'YS1', plateNo: '云A-12345', status: '已完成', shipDate: '2026-07-14' },
      { code: 'YS2', plateNo: '云A 12345', status: '运输中', shipDate: '2026-07-13' },
    ])
    expect(order?.code).toBe('YS2')
  })
})

describe('gPS provider resolution', () => {
  it('falls back to 808gps when GPS_PROVIDER is blank', () => {
    vi.stubEnv('GPS_PROVIDER', '')
    expect(resolveGpsProviderName()).toBe('808gps')
  })

  it('rejects unsupported configured providers', () => {
    vi.stubEnv('GPS_PROVIDER', 'unsupported')
    expect(() => resolveGpsProviderName()).toThrow('GPS 服务商 unsupported 未配置')
  })
})
