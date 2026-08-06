import type { GpsAlarmPayload, GpsLocationPayload, GpsProviderAdapter, OnlineStatus } from './types'
import process from 'node:process'

const alarmTypeNames: Record<number, string> = {
  2: '紧急报警',
  3: '震动/碰撞报警',
  11: '超速报警',
  14: '停留超时',
  16: 'ACC开启',
  17: '设备上线',
  18: 'GPS信号丢失',
  27: '进入围栏',
  28: '离开围栏',
  49: '疲劳驾驶',
  67: '设备离线',
  113: '自定义/平台事件',
  125: '疲劳驾驶',
  140: '离线预警',
  202: 'GNSS模块故障',
  203: 'GNSS天线断开',
  204: 'GNSS天线短路',
  205: '主电源欠压',
  206: '主电源掉电',
  214: '路线偏离',
  219: '碰撞侧翻报警',
  255: '主电源欠压报警结束',
  256: '主电源掉电报警结束',
}

export function get808AlarmReason(item: Record<string, any>) {
  const type = Number(item.type)
  const name = alarmTypeNames[type]
  if (type === 113)
    return `${name}（代码 ${Number(item.info) || type}）`
  return name || `报警代码 ${Number.isFinite(type) ? type : '未知'}`
}

export function resolve808GpsCoordinates(item: Record<string, any>) {
  const coordinate = (value: any) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed))
      return 0
    return Math.abs(parsed) > 1000 ? parsed / 1_000_000 : parsed
  }
  return {
    latitude: coordinate(item.mlat ?? item.lat ?? item.y),
    longitude: coordinate(item.mlng ?? item.lng ?? item.x),
  }
}

function format808GpsTime(value: string | undefined, fallback: Date) {
  const parsed = value ? new Date(value) : fallback
  if (Number.isNaN(parsed.getTime()))
    throw new Error('轨迹查询时间格式无效')
  return new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')
}

export function normalize808GpsTrackRange(startTime?: string, endTime?: string, currentTime = new Date()) {
  const end = endTime ? new Date(endTime) : currentTime
  if (Number.isNaN(end.getTime()))
    throw new Error('轨迹查询结束时间格式无效')
  const start = startTime ? new Date(startTime) : new Date(end.getTime() - 24 * 60 * 60 * 1000)
  if (Number.isNaN(start.getTime()))
    throw new Error('轨迹查询开始时间格式无效')
  if (start.getTime() > end.getTime())
    throw new Error('轨迹查询开始时间不能晚于结束时间')
  return {
    startTime: format808GpsTime(start.toISOString(), start),
    endTime: format808GpsTime(end.toISOString(), end),
  }
}

export function create808GpsProvider(): GpsProviderAdapter {
  const env = (name: string) => process.env[name] || ''
  const baseUrl = (env('GPS_808_BASE_URL') || 'https://www.qhzfclw.com').replace(/\/+$/, '')
  const token = env('GPS_808_TOKEN')
  const username = env('GPS_808_USERNAME')
  const password = env('GPS_808_PASSWORD')
  let session = token

  const numberValue = (value: any, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
  const mapOnline = (value: any): OnlineStatus => value === true || value === 1 || value === '1'
    ? 'online'
    : value === false || value === 0 || value === '0' ? 'offline' : 'unknown'

  function mapLocation(item: Record<string, any>, fallbackDeviceId?: string): GpsLocationPayload {
    const coordinates = resolve808GpsCoordinates(item)
    return {
      deviceId: String(item.id ?? item.did ?? item.devIdno ?? item.DevIDNO ?? fallbackDeviceId ?? ''),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      speed: numberValue(item.sp ?? item.speed) / (item.sp !== undefined ? 10 : 1),
      direction: numberValue(item.hx ?? item.direction),
      altitude: numberValue(item.altitude ?? item.alt),
      accStatus: item.ac === 1 || item.ac === '1' ? 'on' : item.ac === 0 || item.ac === '0' ? 'off' : 'unknown',
      onlineStatus: mapOnline(item.ol ?? item.online),
      locationTime: String(item.gt ?? item.time ?? item.gpsTime ?? new Date().toISOString()),
      address: String(item.address ?? item.addr ?? item.position ?? item.poi ?? item.ps ?? '').trim() || undefined,
      rawData: item,
    }
  }

  function assertConfigured() {
    if (!baseUrl)
      throw new Error('GPS_808_BASE_URL 未配置')
    if (!token && (!username || !password))
      throw new Error('GPS_808_TOKEN 或 GPS_808_USERNAME/GPS_808_PASSWORD 未配置')
  }

  async function login() {
    if (token)
      return token
    const result = await request('/StandardApiAction_login.action', { account: username, password }, false)
    session = String(result.jsession ?? result.JSESSIONID ?? result.session ?? '')
    if (!session)
      throw new Error('808GPS 登录成功但未返回 jsession')
    return session
  }

  async function request(path: string, params: Record<string, any> = {}, authenticated = true, retry = true, timeout = 20_000): Promise<Record<string, any>> {
    assertConfigured()
    if (authenticated && !session)
      await login()
    const query = new URLSearchParams()
    if (authenticated)
      query.set('jsession', session)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '')
        query.set(key, String(value))
    })
    const response = await fetch(`${baseUrl}${path}?${query}`, { signal: AbortSignal.timeout(timeout) })
    if (!response.ok)
      throw new Error(`808GPS 请求失败: HTTP ${response.status}`)
    const data = await response.json() as Record<string, any>
    if (Number(data.result ?? 0) === 5 && authenticated && retry && !token) {
      session = ''
      await login()
      return request(path, params, authenticated, false, timeout)
    }
    if (Number(data.result ?? 0) !== 0)
      throw new Error(`808GPS 接口返回错误: ${data.result}${data.message ? ` (${data.message})` : ''}`)
    return data
  }

  return {
    provider: '808gps',
    async syncDevices() {
      const data = await request('/StandardApiAction_queryUserVehicle.action', { language: 'zh' })
      return (Array.isArray(data.vehicles) ? data.vehicles : []).flatMap((vehicle: Record<string, any>) => {
        const vehicleName = String(vehicle.nm ?? vehicle.vehiIdno ?? '')
        return (Array.isArray(vehicle.dl) ? vehicle.dl : []).map((device: Record<string, any>) => ({
          deviceId: String(device.id ?? device.did ?? device.devIdno),
          deviceNo: String(device.id ?? device.did ?? device.devIdno),
          deviceName: vehicleName || String(device.name ?? device.id),
          simNo: device.sim ? String(device.sim) : undefined,
          onlineStatus: mapOnline(device.ol ?? device.online),
          rawData: { vehicle, device },
        }))
      })
    },
    async getLatestLocations(deviceIds) {
      const groups = await Promise.all(deviceIds.map(async (deviceId) => {
        const data = await request('/StandardApiAction_getDeviceStatus.action', { devIdno: deviceId, toMap: 2, language: 'zh' })
        return (Array.isArray(data.status) ? data.status : []).map((item: Record<string, any>) => mapLocation(item, deviceId))
      }))
      return groups.flat()
    },
    async getTrack(deviceId, startTime, endTime) {
      const range = normalize808GpsTrackRange(startTime, endTime)
      const data = await request('/StandardApiAction_queryTrackDetail.action', {
        devIdno: deviceId,
        begintime: range.startTime,
        endtime: range.endTime,
        distance: 0,
        parkTime: 0,
        currentPage: 1,
        pageRecords: 5000,
        toMap: 2,
      }, true, true, 45_000)
      return (Array.isArray(data.tracks) ? data.tracks : []).map((item: Record<string, any>) => mapLocation(item, deviceId))
    },
    async syncAlarms(deviceIds) {
      const groups = await Promise.all(deviceIds.map(async (deviceId) => {
        const data = await request('/StandardApiAction_vehicleAlarm.action', { DevIDNO: deviceId, toMap: 2 })
        return (Array.isArray(data.alarmlist) ? data.alarmlist : []).map((item: Record<string, any>) => ({
          deviceId: String(item.DevIDNO ?? item.devIdno ?? deviceId),
          alarmType: get808AlarmReason(item),
          alarmLevel: Number(item.level ?? item.type) >= 600 ? 'high' : 'medium',
          alarmTime: String(item.time ?? item.srcTm ?? new Date().toISOString()),
          latitude: resolve808GpsCoordinates(item.Gps ?? item).latitude,
          longitude: resolve808GpsCoordinates(item.Gps ?? item).longitude,
          speed: numberValue(item.Gps?.sp ?? item.sp ?? item.speed) / ((item.Gps?.sp ?? item.sp) !== undefined ? 10 : 1),
          rawData: item,
        } satisfies GpsAlarmPayload))
      }))
      return groups.flat()
    },
  }
}
