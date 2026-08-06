export type GpsProvider = '808gps'
export type OnlineStatus = 'online' | 'offline' | 'unknown'
export type AccStatus = 'on' | 'off' | 'unknown'

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
}

export interface VehicleDeviceBind {
  id: string
  vehicleId: string
  deviceId: string
  plateNo: string
  provider: GpsProvider
  bindTime: string
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
  status: 'unhandled' | 'handled' | 'ignored'
  handleRemark?: string
  handledBy?: string
  handledAt?: string
  provider: GpsProvider
  businessType?: string
  businessId?: string
}

export interface GpsMapData {
  vehicles: Array<TransportVehicle & { deviceId?: string, onlineStatus: OnlineStatus, speed: number, locationTime?: string }>
  locations: GpsLocationLatest[]
  tracks: Array<GpsLocationLatest & { businessType?: string, businessId?: string }>
  alarms: GpsAlarmRecord[]
  geofences: any[]
  binds: VehicleDeviceBind[]
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
  vehicles?: Array<{ vehicleId: string }>
}

export interface GpsOperationLog {
  id: string
  action: string
  operatorName: string
  targetType: string
  targetId: string
  message: string
  createdAt: string
}

interface GpsSyncRequestOptions {
  silent?: boolean
}

function gpsSyncRequestConfig(options: GpsSyncRequestOptions = {}) {
  return {
    timeout: 45_000,
    errorNotification: !options.silent,
  }
}

function gpsReadRequestConfig(timeout = 45_000) {
  return {
    timeout,
    errorNotification: false,
  }
}

function accessParams() {
  const userStore = useUserStore()
  return {
    userId: userStore.userInfo?.id,
    role: userStore.roles?.includes('ADMIN') ? 'ADMIN' : 'USER',
  }
}

export function getGpsProviderConfigsApi() {
  return useGet<any[]>('/gps/provider-configs', undefined, gpsReadRequestConfig())
}

export function getGpsVehiclesApi() {
  return useGet<TransportVehicle[]>('/gps/vehicles', accessParams(), gpsReadRequestConfig())
}

export function getGpsDevicesApi() {
  return useGet<GpsDevice[]>('/gps/devices', undefined, gpsReadRequestConfig())
}

export function syncGpsDevicesApi(provider?: GpsProvider, options?: GpsSyncRequestOptions) {
  return usePost<any>('/gps/devices/sync', { provider }, gpsSyncRequestConfig(options))
}

export function bindGpsDeviceApi(vehicleId: string, data: { deviceId: string, provider?: GpsProvider, operatorId?: string | number, operatorName?: string }) {
  return usePost<VehicleDeviceBind>(`/gps/vehicles/${vehicleId}/bind-device`, data)
}

export function getGpsLatestLocationsApi() {
  return useGet<GpsLocationLatest[]>('/gps/locations/latest', accessParams())
}

export function syncGpsLatestLocationsApi(provider?: GpsProvider, options?: GpsSyncRequestOptions) {
  return usePost<any>('/gps/locations/sync', { provider }, gpsSyncRequestConfig(options))
}

export function getGpsVehicleLocationApi(vehicleId: string) {
  return useGet<GpsLocationLatest | undefined>(`/gps/vehicles/${vehicleId}/location`)
}

export function getGpsVehicleTrackApi(vehicleId: string, params?: { startTime?: string, endTime?: string, provider?: GpsProvider }) {
  return useGet<any>(`/gps/vehicles/${vehicleId}/track`, params, gpsReadRequestConfig(60_000))
}

export function getGpsAlarmsApi() {
  return useGet<GpsAlarmRecord[]>('/gps/alarms', accessParams())
}

export function syncGpsAlarmsApi(provider?: GpsProvider, options?: GpsSyncRequestOptions) {
  return usePost<any>('/gps/alarms/sync', { provider }, gpsSyncRequestConfig(options))
}

export function getGpsVehicleStatusesApi() {
  return useGet<Array<TransportVehicle & { deviceId?: string, onlineStatus: OnlineStatus, speed: number, locationTime?: string }>>('/gps/status')
}

export function getGpsMapDataApi() {
  return useGet<GpsMapData>('/gps/map-data', accessParams(), gpsReadRequestConfig())
}

export function getGpsGeofencesApi() {
  return useGet<GpsGeofence[]>('/gps/geofences')
}

export function getGpsSyncLogsApi() {
  return useGet<any[]>('/gps/sync-logs', undefined, gpsReadRequestConfig())
}

export function handleGpsAlarmApi(id: string, data: { status: 'handled' | 'ignored', handleRemark?: string, operatorId?: string | number, operatorName?: string }) {
  return usePost<GpsAlarmRecord>(`/gps/alarms/${id}/handle`, data)
}

export function createGpsGeofenceApi(data: Partial<GpsGeofence> & { operatorId?: string | number, operatorName?: string }) {
  return usePost<GpsGeofence>('/gps/geofences', data)
}

export function syncGpsRouteGeofencesApi(data: {
  routeCode: string
  routeName: string
  loadingAddress: string
  unloadingAddress: string
  loadingCenter?: [number, number]
  unloadingCenter?: [number, number]
  radius?: number
}) {
  return usePost<GpsGeofence[]>('/gps/geofences/sync-route', data)
}

export function updateGpsGeofenceApi(id: string, data: Partial<GpsGeofence> & { operatorId?: string | number, operatorName?: string }) {
  return usePut<GpsGeofence>(`/gps/geofences/${id}`, data)
}

export function bindGpsGeofenceVehiclesApi(id: string, data: { vehicleIds: string[], operatorId?: string | number, operatorName?: string }) {
  return usePost<GpsGeofence>(`/gps/geofences/${id}/bind-vehicles`, data)
}

export function getGpsOperationLogsApi() {
  return useGet<GpsOperationLog[]>('/gps/operation-logs', undefined, gpsReadRequestConfig())
}

export function geocodeGpsAddressApi(address: string) {
  return useGet<{ address: string, longitude: number, latitude: number, level: string, precise: boolean }>('/gps/geocode', { address }, { errorNotification: false })
}
