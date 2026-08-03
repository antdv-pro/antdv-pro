export type GpsProvider = '808gps'
export type OnlineStatus = 'online' | 'offline' | 'unknown'
export type AccStatus = 'on' | 'off' | 'unknown'

export interface GpsDevicePayload {
  deviceId: string
  deviceNo: string
  deviceName: string
  simNo?: string
  onlineStatus: OnlineStatus
  rawData?: Record<string, any>
}

export interface GpsLocationPayload {
  deviceId: string
  latitude: number
  longitude: number
  speed: number
  direction: number
  altitude: number
  accStatus: AccStatus
  onlineStatus: OnlineStatus
  locationTime: string
  address?: string
  rawData?: Record<string, any>
}

export interface GpsAlarmPayload {
  deviceId: string
  alarmType: string
  alarmLevel: 'low' | 'medium' | 'high'
  alarmTime: string
  latitude: number
  longitude: number
  speed: number
  rawData?: Record<string, any>
}

export interface GpsProviderAdapter {
  provider: GpsProvider
  syncDevices: () => Promise<GpsDevicePayload[]>
  getLatestLocations: (deviceIds: string[]) => Promise<GpsLocationPayload[]>
  getTrack: (deviceId: string, startTime?: string, endTime?: string) => Promise<GpsLocationPayload[]>
  syncAlarms: (deviceIds: string[]) => Promise<GpsAlarmPayload[]>
}
