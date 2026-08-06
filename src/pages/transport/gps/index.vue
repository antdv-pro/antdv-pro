<script setup lang="ts">
/* eslint-disable ts/no-use-before-define -- event handlers read selected state only after setup completes */
import type { GpsAlarmRecord, GpsDevice, GpsGeofence, GpsLocationLatest, GpsMapData, TransportVehicle } from '~@/api/gps'
import type { GpsFenceForm } from './components/types'
import { LineLayer, MapLibre, PointLayer, Scene } from '@antv/l7'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import {
  bindGpsDeviceApi,
  bindGpsGeofenceVehiclesApi,
  createGpsGeofenceApi,
  getGpsDevicesApi,
  getGpsMapDataApi,
  getGpsOperationLogsApi,
  getGpsProviderConfigsApi,
  getGpsSyncLogsApi,
  getGpsVehiclesApi,
  handleGpsAlarmApi,
  syncGpsAlarmsApi,
  syncGpsDevicesApi,
  syncGpsLatestLocationsApi,
  updateGpsGeofenceApi,
} from '~@/api/gps'
import SummaryCards from '~@/components/summary-cards/index.vue'
import { displayGpsLocation, queueGpsChineseAddresses } from '~@/composables/gps-location-address'
import { loadTransportOperationData, transportBaseRouteRows } from '~@/composables/transport-operation-data'
import { createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from '~@/utils/business-table'
import { createFinancialComparison } from '~@/utils/financial-comparison'
import { getCurrentFinancialMonthRange } from '~@/utils/financialPeriod'
import { isGeofenceLocationFresh, isPointInGeofence } from '~@/utils/geofence'
import GpsAlarmPanel from './components/gps-alarm-panel.vue'
import GpsDevicePanel from './components/gps-device-panel.vue'
import GpsGeofencePanel from './components/gps-geofence-panel.vue'
import GpsLogPanel from './components/gps-log-panel.vue'
import GpsProviderPanel from './components/gps-provider-panel.vue'
import GpsTrackPanel from './components/gps-track-panel.vue'
import { useGpsTrackQuery } from './composables/use-gps-track-query'
import { summarizeGpsAlarms } from './utils/gps-financial-summary'

defineOptions({
  name: 'TransportGpsMonitor',
})

const message = useMessage()
const userStore = useUserStore()
const route = useRoute()
const loading = ref(false)
const syncing = ref(false)
const autoRefreshing = ref(false)
const lastAlarmSyncAt = ref('')
const lastAutoRefreshAt = ref('')
const errorMessage = ref('')
const activeTab = ref('console')
const consoleTab = ref('positions')
const selectedVehicleId = ref('')
const selectedDeviceId = ref('')
const provider = ref<'808gps'>('808gps')
const keyword = ref('')
const onlineFilter = ref<'all' | 'online' | 'offline'>('all')
const vehicles = ref<TransportVehicle[]>([])
const devices = ref<GpsDevice[]>([])
const mapData = ref<GpsMapData>()
const providerConfigs = ref<any[]>([])
const syncLogs = ref<any[]>([])
const operationLogs = ref<any[]>([])
const mapContainer = ref<HTMLDivElement>()
let mapScene: Scene | undefined
let vehicleLayer: any
let vehicleLabelLayer: any
let vehicleDirectionLayer: any
let clusterLayer: any
let clusterLabelLayer: any
let trackLayer: any
let geofenceLayer: any
let geofenceLabelLayer: any
const playing = ref(false)
const playSpeed = ref(1)
const playIndex = ref(0)
let playTimer: ReturnType<typeof setInterval> | undefined
let dataRefreshTimer: ReturnType<typeof setInterval> | undefined
const { trackLoading, trackPoints, trackRange, loadTrack } = useGpsTrackQuery({
  message,
  selectedVehicleId,
  provider,
  pause: pauseTrack,
  onLoaded: () => {
    playIndex.value = 0
    activeTab.value = 'tracks'
  },
})
const alarmTypeFilter = ref('all')
const alarmStatusFilter = ref('all')
const alarmRemark = ref('已处理并通知司机')
const fenceSaving = ref(false)
const fenceForm = reactive<GpsFenceForm>({
  id: '',
  name: '',
  address: '',
  routeCode: '',
  routeStage: 'loading' as 'loading' | 'unloading',
  shape: 'circle' as 'circle' | 'polygon',
  centerLongitude: 94.91,
  centerLatitude: 36.4,
  radius: 1500,
  polygonPoints: '',
  enabled: true,
  vehicleIds: [] as string[],
})
const locations = computed(() => mapData.value?.locations ?? [])
const alarms = computed(() => mapData.value?.alarms ?? [])
const vehicleStatuses = computed(() => mapData.value?.vehicles ?? [])
const geofences = computed(() => [...(mapData.value?.geofences ?? [])].sort((a, b) => {
  const priority = (fence: GpsGeofence) => fence.id === 'fence-company-parking' || fence.name === '公司停车场' ? 0 : 1
  return priority(a) - priority(b) || String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
}))
const routeOptions = computed(() => transportBaseRouteRows.value.filter(item => item.status !== '停用'))
const fenceJudgments = computed(() => new Map(geofences.value.map((fence: GpsGeofence) => {
  const boundIds = new Set(fence.vehicles?.map(item => item.vehicleId) ?? [])
  const boundLocations = locations.value.filter(item => boundIds.has(item.vehicleId))
  const freshLocations = boundLocations.filter(item => isGeofenceLocationFresh(item.locationTime))
  const insideCount = freshLocations.filter(location => isPointInGeofence([location.longitude, location.latitude], fence)).length
  return [fence.id, { insideCount, locatedCount: freshLocations.length, staleCount: boundLocations.length - freshLocations.length }]
})))

function displayLocationAddress(location?: GpsLocationLatest) {
  return displayGpsLocation(location, geofences.value)
}

function normalizePlateNo(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[\s·•\-]/g, '')
}

function selectRouteVehicle() {
  const queryVehicleId = String(route.query.vehicleId ?? '')
  const queryPlateNo = normalizePlateNo(route.query.plateNo)
  const queryBusinessId = String(route.query.businessId ?? '')
  const linkedVehicle = vehicleStatuses.value.find(item =>
    item.vehicleId === queryVehicleId
    || normalizePlateNo(item.plateNo) === queryPlateNo
    || item.currentOrderId === queryBusinessId
    || item.currentOrderNo === queryBusinessId,
  )
  const vehicleId = linkedVehicle?.vehicleId || selectedVehicleId.value || vehicles.value[0]?.vehicleId || ''
  if (vehicleId)
    selectVehicle(vehicleId)
}

function applyRouteFenceDefaults() {
  const selectedRoute = routeOptions.value.find(item => item.code === fenceForm.routeCode)
  if (!selectedRoute)
    return
  const place = fenceForm.routeStage === 'loading' ? selectedRoute.loadingAddress : selectedRoute.unloadingAddress
  fenceForm.name = `${selectedRoute.name}-${fenceForm.routeStage === 'loading' ? '装车' : '卸车'}围栏`
  fenceForm.address = place || ''
  if (!fenceForm.id)
    fenceForm.shape = 'circle'
  message.info(`${place || '该地点'}需要录入准确经纬度后才能判断车辆是否进入`)
}

function useSelectedVehicleLocation() {
  if (!selectedLocation.value) {
    message.warning('当前选中车辆没有定位数据')
    return
  }
  fenceForm.centerLongitude = selectedLocation.value.longitude
  fenceForm.centerLatitude = selectedLocation.value.latitude
  message.success(`已使用 ${selectedLocation.value.plateNo} 的最新定位`)
}

const selectedVehicle = computed(() => vehicleStatuses.value.find(item => item.vehicleId === selectedVehicleId.value))
const selectedLocation = computed(() => locations.value.find(item => item.vehicleId === selectedVehicleId.value))
const selectedRecentAlarm = computed(() => alarms.value.find(item => item.vehicleId === selectedVehicleId.value))
const currentProviderConfig = computed(() => providerConfigs.value.find(item => item.provider === provider.value))
const monitorUrl = computed(() => currentProviderConfig.value?.monitorUrl || 'https://www.qhzfclw.com/808gps/index.html?lang=zh&isLogin=1&vType=v7')
const latestLocationByVehicleId = computed(() => new Map(locations.value.map(location => [location.vehicleId, location])))

function vehicleLocationLabel(vehicleId: string) {
  return displayLocationAddress(latestLocationByVehicleId.value.get(vehicleId)) || '暂无位置'
}

function vehicleOrderLabel(vehicle: TransportVehicle) {
  return [vehicle.driverName, vehicle.currentOrderNo || '无订单'].filter(Boolean).join(' · ')
}

const filteredVehicles = computed(() => {
  return vehicleStatuses.value.filter((vehicle) => {
    const matchedKeyword = !keyword.value || vehicle.plateNo.includes(keyword.value) || vehicle.driverName.includes(keyword.value)
    const matchedStatus = onlineFilter.value === 'all' || vehicle.onlineStatus === onlineFilter.value
    return matchedKeyword && matchedStatus
  })
})

const filteredAlarms = computed(() => {
  return alarms.value.filter((alarm) => {
    const matchedType = alarmTypeFilter.value === 'all' || alarm.alarmType.includes(alarmTypeFilter.value)
    const matchedStatus = alarmStatusFilter.value === 'all' || alarm.status === alarmStatusFilter.value
    return matchedType && matchedStatus
  }).sort((a, b) => new Date(b.alarmTime).getTime() - new Date(a.alarmTime).getTime())
})

const monitorStats = computed(() => {
  const currentPeriod = getCurrentFinancialMonthRange()
  const current = summarizeGpsAlarms(alarms.value, currentPeriod.startDate, currentPeriod.endDate)
  const previousStartDate = currentPeriod.startAt.subtract(1, 'month').format('YYYY-MM-DD')
  const previousEndDate = currentPeriod.endAt.subtract(1, 'month').format('YYYY-MM-DD')
  const previous = summarizeGpsAlarms(alarms.value, previousStartDate, previousEndDate)
  return [
    { label: '本月报警数', value: current.total, comparison: createFinancialComparison(current.total, previous.total, `${previous.total} 条`), tone: 'default' as const },
    { label: '本月已处理', value: current.handled, comparison: createFinancialComparison(current.handled, previous.handled, `${previous.handled} 条`), tone: 'success' as const },
    { label: '本月未处理', value: current.unhandled, comparison: createFinancialComparison(current.unhandled, previous.unhandled, `${previous.unhandled} 条`), tag: current.unhandled ? '需处理' : '正常', tone: current.unhandled ? 'danger' as const : 'success' as const },
    { label: '本月涉及车辆', value: current.vehicles, comparison: createFinancialComparison(current.vehicles, previous.vehicles, `${previous.vehicles} 辆`), tone: 'primary' as const },
  ]
})

const selectedBind = computed(() => mapData.value?.binds.find(item => item.vehicleId === selectedVehicleId.value))
const selectedDevice = computed(() => devices.value.find(item => item.deviceId === selectedBind.value?.deviceId || item.deviceId === selectedDeviceId.value))

const trackClassifiedPoints = computed(() => {
  return trackPoints.value.map((point, index) => ({
    ...point,
    pointType: point.speed === 0 ? 'parking' : point.speed > 60 ? 'overspeed' : alarms.value.some(alarm => alarm.vehicleId === point.vehicleId) && index % 4 === 0 ? 'alarm' : 'normal',
  }))
})

const currentTrackPoint = computed(() => trackClassifiedPoints.value[playIndex.value])

const deviceColumns = [
  { title: '设备编号', dataIndex: 'deviceNo' },
  { title: '设备名称', dataIndex: 'deviceName' },
  { title: '服务商', dataIndex: 'provider' },
  { title: 'SIM卡', dataIndex: 'simNo' },
  { title: '状态', dataIndex: 'onlineStatus' },
]
const deviceTableColumns = computed(() => enhanceBusinessTableColumns(deviceColumns))
const deviceTableScrollX = computed(() => createBusinessTableScrollX(deviceTableColumns.value, 900))

const alarmColumns = [
  { title: '车牌号', dataIndex: 'plateNo' },
  { title: '报警原因', dataIndex: 'alarmType' },
  { title: '报警位置', dataIndex: 'address', width: 280 },
  { title: '级别', dataIndex: 'alarmLevel' },
  { title: '速度', dataIndex: 'speed' },
  { title: '状态', dataIndex: 'status' },
  { title: '处理备注', dataIndex: 'handleRemark' },
  { title: '关联订单', dataIndex: 'businessId' },
  { title: '报警时间', dataIndex: 'alarmTime' },
  { title: '操作', dataIndex: 'action', width: 180 },
]
const alarmTableColumns = computed(() => enhanceBusinessTableColumns(alarmColumns))
const alarmTableScrollX = computed(() => createBusinessTableScrollX(alarmTableColumns.value, 1480))

const trackColumns = [
  { title: '点位类型', dataIndex: 'pointType' },
  { title: '车牌号', dataIndex: 'plateNo' },
  { title: '经度', dataIndex: 'longitude' },
  { title: '纬度', dataIndex: 'latitude' },
  { title: '速度', dataIndex: 'speed' },
  { title: 'ACC', dataIndex: 'accStatus' },
  { title: '定位时间', dataIndex: 'locationTime' },
]
const trackTableColumns = computed(() => enhanceBusinessTableColumns(trackColumns, { numberFields: ['longitude', 'latitude'] }))
const trackTableScrollX = computed(() => createBusinessTableScrollX(trackTableColumns.value, 900))

const syncLogColumns = [
  { title: '服务商', dataIndex: 'provider' },
  { title: '同步类型', dataIndex: 'syncType' },
  { title: '状态', dataIndex: 'status' },
  { title: '消息', dataIndex: 'message' },
  { title: '完成时间', dataIndex: 'finishedAt' },
]
const syncLogTableColumns = computed(() => enhanceBusinessTableColumns(syncLogColumns))
const syncLogTableScrollX = computed(() => createBusinessTableScrollX(syncLogTableColumns.value, 760))

const operationLogColumns = [
  { title: '操作', dataIndex: 'action' },
  { title: '操作人', dataIndex: 'operatorName' },
  { title: '对象', dataIndex: 'targetType' },
  { title: '说明', dataIndex: 'message' },
  { title: '时间', dataIndex: 'createdAt' },
]
const operationLogTableColumns = computed(() => enhanceBusinessTableColumns(operationLogColumns))
const operationLogTableScrollX = computed(() => createBusinessTableScrollX(operationLogTableColumns.value, 760))

const locationConsoleRows = computed(() => locations.value.map((location) => {
  const vehicle = vehicleStatuses.value.find(item => item.vehicleId === location.vehicleId)
  return {
    ...location,
    address: displayLocationAddress(location),
    driverName: vehicle?.driverName || '',
    currentOrderNo: vehicle?.currentOrderNo || '',
    speedDirection: `${location.speed.toFixed(1)} (${directionLabel(location.direction)})`,
  }
}))

const locationConsoleColumns = computed(() => enhanceBusinessTableColumns([
  { title: '操作', dataIndex: 'action', width: 92, fixed: 'left' },
  { title: '车牌号', dataIndex: 'plateNo', width: 130, fixed: 'left' },
  { title: '速度(公里/时)', dataIndex: 'speedDirection', width: 160 },
  { title: '位置时间', dataIndex: 'locationTime', width: 180 },
  { title: '位置', dataIndex: 'address', width: 420 },
  { title: '司机', dataIndex: 'driverName', width: 120 },
  { title: '运输订单', dataIndex: 'currentOrderNo', width: 150 },
  { title: '状态', dataIndex: 'onlineStatus', width: 100 },
]))
const locationConsoleScrollX = computed(() => createBusinessTableScrollX(locationConsoleColumns.value, 1560))

function directionLabel(direction?: number) {
  const value = ((Number(direction) || 0) % 360 + 360) % 360
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return labels[Math.round(value / 45) % 8]
}

function exportLocations() {
  const sheet = XLSX.utils.json_to_sheet(locationConsoleRows.value.map(row => ({
    车牌号: row.plateNo,
    '速度(公里/时)': row.speedDirection,
    位置时间: row.locationTime,
    位置: row.address,
    司机: row.driverName,
    运输订单: row.currentOrderNo,
    状态: onlineStatusLabel(row.onlineStatus),
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '位置监控')
  XLSX.writeFile(workbook, `北斗位置监控_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`)
}

function locationRowProps(record: GpsLocationLatest) {
  return {
    onClick: () => selectVehicle(record.vehicleId),
  }
}

function providerLabel(value?: string) {
  const labelMap: Record<string, string> = {
    '808gps': '八零八定位服务',
  }
  return value ? labelMap[value] ?? value : '未知服务商'
}

function onlineStatusLabel(value?: string) {
  const labelMap: Record<string, string> = {
    online: '在线',
    offline: '离线',
    unknown: '未知',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function accStatusLabel(value?: string) {
  const labelMap: Record<string, string> = {
    on: '开启',
    off: '关闭',
    unknown: '未知',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function alarmLevelLabel(value?: string) {
  const labelMap: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function alarmStatusLabel(value?: string) {
  const labelMap: Record<string, string> = {
    unhandled: '未处理',
    handled: '已处理',
    ignored: '已忽略',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function pointTypeLabel(value?: string) {
  const labelMap: Record<string, string> = {
    parking: '停车',
    overspeed: '超速',
    alarm: '报警',
    normal: '正常',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function syncTypeLabel(value?: string) {
  const labelMap: Record<string, string> = {
    devices: '设备',
    'latest-location': '实时定位',
    tracks: '轨迹',
    alarms: '报警',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function syncStatusLabel(value?: string) {
  const labelMap: Record<string, string> = {
    success: '成功',
    failed: '失败',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function booleanLabel(value?: boolean) {
  return value ? '是' : '否'
}

function targetTypeLabel(value?: string) {
  const labelMap: Record<string, string> = {
    gps_alarm_record: '报警记录',
    gps_geofence: '电子围栏',
  }
  return value ? labelMap[value] ?? value : '未知'
}

function openMonitorConsole() {
  if (!monitorUrl.value) {
    message.warning('未配置北斗监控台地址')
    return
  }
  window.open(monitorUrl.value, '_blank', 'noopener,noreferrer')
}

function operatorPayload() {
  return {
    operatorId: userStore.userInfo?.id ?? 1,
    operatorName: userStore.nickname || '当前用户',
  }
}

function statusColor(status?: string) {
  if (status === 'online' || status === 'success' || status === 'handled' || status === 'normal')
    return 'success'
  if (status === 'offline' || status === 'failed' || status === 'high' || status === 'overspeed')
    return 'error'
  if (status === 'unhandled' || status === 'medium' || status === 'parking' || status === 'alarm')
    return 'warning'
  return 'default'
}

function selectVehicle(vehicleId: string) {
  selectedVehicleId.value = vehicleId
  const bind = mapData.value?.binds.find(item => item.vehicleId === vehicleId)
  if (bind)
    selectedDeviceId.value = bind.deviceId
  const location = locations.value.find(item => item.vehicleId === vehicleId)
  if (location && mapScene) {
    mapScene.setCenter([location.longitude, location.latitude])
    mapScene.setZoom(11)
  }
}

function removeMapLayers() {
  for (const layer of [vehicleLayer, vehicleLabelLayer, vehicleDirectionLayer, clusterLayer, clusterLabelLayer, trackLayer, geofenceLayer, geofenceLabelLayer]) {
    if (layer && mapScene)
      mapScene.removeLayer(layer)
    layer?.destroy?.()
  }
  vehicleLayer = undefined
  vehicleLabelLayer = undefined
  vehicleDirectionLayer = undefined
  clusterLayer = undefined
  clusterLabelLayer = undefined
  trackLayer = undefined
  geofenceLayer = undefined
  geofenceLabelLayer = undefined
}

function circleFenceCoordinates(center: [number, number], radius: number) {
  const [longitude, latitude] = center
  const latitudeRadius = radius / 111320
  const longitudeRadius = radius / (111320 * Math.max(Math.cos(latitude * Math.PI / 180), 0.1))
  return Array.from({ length: 65 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2
    return [longitude + longitudeRadius * Math.cos(angle), latitude + latitudeRadius * Math.sin(angle)]
  })
}

function geofenceLineFeatures() {
  return geofences.value.flatMap((fence: GpsGeofence) => {
    const coordinates = fence.shape === 'circle' && fence.center && fence.radius
      ? circleFenceCoordinates(fence.center, fence.radius)
      : fence.points?.length ? [...fence.points, fence.points[0]] : []
    if (coordinates.length < 2)
      return []
    return [{
      type: 'Feature',
      properties: { id: fence.id, name: fence.name, color: fence.enabled ? '#fa8c16' : '#94a3b8' },
      geometry: { type: 'LineString', coordinates },
    }]
  })
}

function geofenceLabels() {
  return geofences.value.flatMap((fence: GpsGeofence) => {
    const center = fence.center ?? fence.points?.[0]
    return center ? [{ id: fence.id, name: fence.name, longitude: center[0], latitude: center[1] }] : []
  })
}

function focusFence(fence: GpsGeofence) {
  if (!mapScene)
    return
  const center = fence.center ?? fence.points?.[0]
  if (!center)
    return
  mapScene.setCenter(center)
  mapScene.setZoom(fence.shape === 'circle' && (fence.radius ?? 0) > 10000 ? 8 : 11)
}

function renderActualMap() {
  if (!mapScene || !mapScene.loaded)
    return
  removeMapLayers()
  const fenceFeatures = geofenceLineFeatures()
  if (fenceFeatures.length) {
    geofenceLayer = new LineLayer({})
      .source({ type: 'FeatureCollection', features: fenceFeatures })
      .shape('line')
      .size(3)
      .color('color')
      .style({ opacity: 0.9, lineType: 'dash', dashArray: [6, 4] })
    mapScene.addLayer(geofenceLayer)
  }
  const fenceLabels = geofenceLabels()
  if (fenceLabels.length) {
    geofenceLabelLayer = new PointLayer({})
      .source(fenceLabels, { parser: { type: 'json', x: 'longitude', y: 'latitude' } })
      .shape('name', 'text')
      .size(13)
      .color('#ad4e00')
      .style({ stroke: '#ffffff', strokeWidth: 4, textAnchor: 'center', textOffset: [0, -14] })
    mapScene.addLayer(geofenceLabelLayer)
  }
  const vehiclePoints = locations.value.map(location => ({
    ...location,
    mapColor: alarms.value.some(alarm => alarm.vehicleId === location.vehicleId && alarm.status === 'unhandled')
      ? '#dc2626'
      : location.onlineStatus === 'online' ? '#1677ff' : '#64748b',
  }))
  if (vehiclePoints.length) {
    const clusterSourceOptions = {
      parser: { type: 'json', x: 'longitude', y: 'latitude' },
      cluster: true,
      clusterOptions: { radius: 60, maxZoom: 7, minPoints: 2 },
    } as any
    clusterLayer = new PointLayer({ autoFit: !selectedVehicleId.value, maxZoom: 7 })
      .source(vehiclePoints, clusterSourceOptions)
      .shape('circle')
      .size('point_count', [22, 42])
      .color('point_count', ['#69b1ff', '#1677ff', '#0958d9'])
      .style({ stroke: '#ffffff', strokeWidth: 2, opacity: 0.92 })
      .active({ color: '#003eb3' })
    clusterLayer.on('click', (event: any) => {
      const coordinates = event.feature?.coordinates ?? event.lngLat
      if (coordinates && mapScene) {
        const center = (Array.isArray(coordinates) ? coordinates : [coordinates.lng, coordinates.lat]) as [number, number]
        mapScene.setCenter(center)
        mapScene.setZoom(Math.min((mapScene.getZoom?.() ?? 4) + 2, 10))
      }
    })
    mapScene.addLayer(clusterLayer)

    clusterLabelLayer = new PointLayer({ maxZoom: 7 })
      .source(vehiclePoints, clusterSourceOptions)
      .shape('point_count', 'text')
      .size(13)
      .color('#ffffff')
      .style({ strokeWidth: 0 })
    mapScene.addLayer(clusterLabelLayer)

    vehicleLayer = new PointLayer({ minZoom: 7 })
      .source(vehiclePoints, { parser: { type: 'json', x: 'longitude', y: 'latitude' } })
      .shape('circle')
      .size(16)
      .color('mapColor')
      .style({ stroke: '#ffffff', strokeWidth: 2, opacity: 0.95 })
      .active({ color: '#0958d9' })
    vehicleLayer.on('click', (event: any) => selectVehicle(String(event.feature?.vehicleId ?? '')))
    mapScene.addLayer(vehicleLayer)

    vehicleDirectionLayer = new PointLayer({ minZoom: 7 })
      .source(vehiclePoints, { parser: { type: 'json', x: 'longitude', y: 'latitude' } })
      .shape('triangle')
      .size(8)
      .color('#ffffff')
      .rotate('direction')
      .style({ opacity: 1 })
    mapScene.addLayer(vehicleDirectionLayer)

    vehicleLabelLayer = new PointLayer({ minZoom: 7 })
      .source(vehiclePoints, { parser: { type: 'json', x: 'longitude', y: 'latitude' } })
      .shape('plateNo', 'text')
      .size(12)
      .color('#0f172a')
      .style({
        textAnchor: 'center',
        textOffset: [0, 20],
        stroke: '#ffffff',
        strokeWidth: 3,
        opacity: 1,
      })
    mapScene.addLayer(vehicleLabelLayer)
  }

  if (trackPoints.value.length > 1) {
    trackLayer = new LineLayer({})
      .source({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trackPoints.value.map(point => [point.longitude, point.latitude]),
          },
        }],
      })
      .shape('line')
      .size(4)
      .color('#1677ff')
      .style({ opacity: 0.85 })
    mapScene.addLayer(trackLayer)
  }
}

function initializeActualMap() {
  if (!mapContainer.value || mapScene)
    return
  mapScene = new Scene({
    id: mapContainer.value,
    logoVisible: false,
    map: new MapLibre({
      center: [103.8, 36.1],
      zoom: 4,
      minZoom: 3,
      maxZoom: 18,
      style: {
        version: 8,
        sources: {
          baseMap: {
            type: 'raster',
            tiles: ['https://webst01.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}'],
            tileSize: 256,
            attribution: '&copy; 高德地图',
          },
        },
        layers: [{ id: 'base-map', type: 'raster', source: 'baseMap' }],
      },
    }),
  })
  mapScene.on('loaded', renderActualMap)
}
async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [vehicleResult, deviceResult, mapResult, providerResult, logResult, opLogResult] = await Promise.allSettled([
      getGpsVehiclesApi(),
      getGpsDevicesApi(),
      getGpsMapDataApi(),
      getGpsProviderConfigsApi(),
      getGpsSyncLogsApi(),
      getGpsOperationLogsApi(),
    ])
    vehicles.value = vehicleResult.status === 'fulfilled' ? (vehicleResult.value.data ?? []) : vehicles.value
    devices.value = deviceResult.status === 'fulfilled' ? (deviceResult.value.data ?? []) : devices.value
    mapData.value = mapResult.status === 'fulfilled' ? mapResult.value.data : mapData.value
    providerConfigs.value = providerResult.status === 'fulfilled' ? (providerResult.value.data ?? []) : providerConfigs.value
    syncLogs.value = logResult.status === 'fulfilled' ? (logResult.value.data ?? []) : syncLogs.value
    operationLogs.value = opLogResult.status === 'fulfilled' ? (opLogResult.value.data ?? []) : operationLogs.value
    provider.value = providerConfigs.value.find(item => item.enabled)?.provider || provider.value
    selectRouteVehicle()
    selectedDeviceId.value ||= devices.value[0]?.deviceId || ''
    const failedCount = [vehicleResult, deviceResult, mapResult, providerResult, logResult, opLogResult].filter(result => result.status === 'rejected').length
    if (mapResult.status === 'rejected') {
      const timedOut = mapResult.reason?.code === 'ECONNABORTED' || String(mapResult.reason?.message ?? '').includes('timeout')
      errorMessage.value = timedOut ? '北斗定位数据响应超时，已保留其他已加载内容，请稍后点击“刷新数据”重试' : (mapResult.reason?.response?.data?.msg || mapResult.reason?.message || '北斗定位数据加载失败')
    }
    else if (failedCount) {
      errorMessage.value = `${failedCount} 项辅助数据暂未加载，车辆定位数据仍可正常使用`
    }
  }
  catch (error: any) {
    errorMessage.value = error?.message || 'GPS 数据加载失败'
    message.error(errorMessage.value)
  }
  finally {
    loading.value = false
  }
}
async function syncDevices() {
  syncing.value = true
  try {
    const res = await syncGpsDevicesApi(provider.value)
    message.success(res.msg)
    await loadData()
  }
  finally {
    syncing.value = false
  }
}

async function syncLocations() {
  syncing.value = true
  try {
    const res = await syncGpsLatestLocationsApi(provider.value)
    message.success(res.msg)
    await loadData()
  }
  finally {
    syncing.value = false
  }
}

async function syncAlarms() {
  syncing.value = true
  try {
    const res = await syncGpsAlarmsApi(provider.value)
    lastAlarmSyncAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    message.success(res.msg)
    await loadData()
  }
  finally {
    syncing.value = false
  }
}

async function refreshMonitorData() {
  if (autoRefreshing.value || syncing.value)
    return
  autoRefreshing.value = true
  try {
    await loadData()
    lastAutoRefreshAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    selectRouteVehicle()
  }
  catch {}
  finally {
    autoRefreshing.value = false
  }
}

async function initializeMonitor() {
  await nextTick()
  initializeActualMap()
  await Promise.all([loadData(), loadTransportOperationData()])
  lastAutoRefreshAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  dataRefreshTimer = setInterval(() => void refreshMonitorData(), 30_000)
}

async function bindDevice() {
  if (!selectedVehicleId.value || !selectedDeviceId.value) {
    message.warning('请选择车辆和设备')
    return
  }
  await bindGpsDeviceApi(selectedVehicleId.value, {
    deviceId: selectedDeviceId.value,
    provider: provider.value,
    ...operatorPayload(),
  })
  message.success('绑定成功')
  await loadData()
}

function playTrack() {
  if (!trackClassifiedPoints.value.length)
    return
  playing.value = true
  clearInterval(playTimer)
  playTimer = setInterval(() => {
    if (playIndex.value >= trackClassifiedPoints.value.length - 1) {
      pauseTrack()
      return
    }
    playIndex.value += 1
  }, Math.max(300, 1200 / playSpeed.value))
}

function pauseTrack() {
  playing.value = false
  clearInterval(playTimer)
}

async function handleAlarm(record: GpsAlarmRecord, status: 'handled' | 'ignored' = 'handled') {
  await handleGpsAlarmApi(record.id, {
    status,
    handleRemark: alarmRemark.value,
    ...operatorPayload(),
  })
  message.success(status === 'handled' ? '报警已处理' : '报警已忽略')
  await loadData()
}
function handleAlarmRecord(record: Record<string, any>, status: 'handled' | 'ignored') {
  return handleAlarm(record as GpsAlarmRecord, status)
}
function editFence(record: GpsGeofence) {
  fenceForm.id = record.id
  fenceForm.name = record.name
  fenceForm.address = record.address ?? ''
  fenceForm.routeCode = record.routeCode ?? ''
  fenceForm.routeStage = record.routeStage ?? 'loading'
  fenceForm.shape = record.shape
  fenceForm.centerLongitude = record.center?.[0] ?? 94.91
  fenceForm.centerLatitude = record.center?.[1] ?? 36.4
  fenceForm.radius = record.radius ?? 3000
  fenceForm.polygonPoints = record.points?.map(point => point.join(',')).join('\n') ?? ''
  fenceForm.enabled = record.enabled
  fenceForm.vehicleIds = record.vehicles?.map(item => item.vehicleId) ?? []
  activeTab.value = 'fences'
  focusFence(record)
}
function resetFenceForm() {
  Object.assign(fenceForm, {
    id: '',
    name: '',
    address: '',
    routeCode: '',
    routeStage: 'loading',
    shape: 'circle',
    centerLongitude: selectedLocation.value?.longitude ?? 94.91,
    centerLatitude: selectedLocation.value?.latitude ?? 36.4,
    radius: 1500,
    polygonPoints: '',
    enabled: true,
    vehicleIds: [],
  })
}
async function saveFence() {
  const points = fenceForm.polygonPoints.split(/\n|;/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.split(',').map(Number) as [number, number])
  if (!fenceForm.name.trim()) {
    message.warning('请输入围栏名称')
    return
  }
  if (geofences.value.some(item => item.name.trim() === fenceForm.name.trim() && item.id !== fenceForm.id)) {
    message.warning('围栏名称已存在')
    return
  }
  if (fenceForm.shape === 'circle' && (!Number.isFinite(fenceForm.centerLongitude) || !Number.isFinite(fenceForm.centerLatitude)
    || Math.abs(fenceForm.centerLongitude) > 180 || Math.abs(fenceForm.centerLatitude) > 90)) {
    message.warning('请输入有效的中心点经纬度')
    return
  }
  if (fenceForm.shape === 'circle' && (fenceForm.radius < 100 || fenceForm.radius > 500000)) {
    message.warning('围栏半径应在 100 至 500000 米之间')
    return
  }
  if (fenceForm.shape === 'polygon' && (points.length < 3 || points.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || Math.abs(longitude) > 180 || Math.abs(latitude) > 90))) {
    message.warning('多边形至少需要 3 个有效经纬度顶点')
    return
  }
  const payload = {
    name: fenceForm.name,
    address: fenceForm.address || undefined,
    routeCode: fenceForm.routeCode || undefined,
    routeName: routeOptions.value.find(item => item.code === fenceForm.routeCode)?.name,
    routeStage: fenceForm.routeCode ? fenceForm.routeStage : undefined,
    shape: fenceForm.shape,
    center: fenceForm.shape === 'circle' ? [fenceForm.centerLongitude, fenceForm.centerLatitude] as [number, number] : undefined,
    radius: fenceForm.shape === 'circle' ? fenceForm.radius : undefined,
    points: fenceForm.shape === 'polygon' ? points : undefined,
    enabled: fenceForm.enabled,
    ...operatorPayload(),
  }
  fenceSaving.value = true
  try {
    const res = fenceForm.id
      ? await updateGpsGeofenceApi(fenceForm.id, payload)
      : await createGpsGeofenceApi(payload)
    if (!res.data?.id)
      throw new Error(res.msg || '围栏保存结果无效')
    await bindGpsGeofenceVehiclesApi(res.data.id, {
      vehicleIds: fenceForm.vehicleIds,
      ...operatorPayload(),
    })
    message.success('围栏已保存')
    resetFenceForm()
    await loadData()
  }
  catch (error: any) {
    message.error(error?.message || '围栏保存失败')
  }
  finally {
    fenceSaving.value = false
  }
}

onMounted(initializeMonitor)
onBeforeUnmount(() => {
  clearInterval(playTimer)
  clearInterval(dataRefreshTimer)
  removeMapLayers()
  mapScene?.destroy?.()
  mapScene = undefined
})

watch([locations, trackPoints, alarms, geofences], () => nextTick(renderActualMap), { deep: true })
watch(locations, value => queueGpsChineseAddresses(value), { deep: true, immediate: true })
</script>

<template>
  <page-container>
    <section class="monitor-hero">
      <div class="hero-main">
        <div class="hero-title-row">
          <div>
            <h1>车辆北斗监控</h1>
            <p>集中查看车辆位置、轨迹回放、设备绑定、电子围栏和报警处理。</p>
          </div>
          <a-tag :color="provider === '808gps' ? 'blue' : 'default'">
            {{ providerLabel(provider) }}
          </a-tag>
        </div>
        <div class="hero-toolbar">
          <a-select v-model:value="provider" class="provider-select">
            <a-select-option value="808gps">
              八零八定位服务
            </a-select-option>
          </a-select>
          <a-button :loading="syncing" @click="syncDevices">
            同步设备
          </a-button>
          <a-button :loading="syncing" @click="syncLocations">
            同步定位
          </a-button>
          <a-button :loading="syncing" @click="syncAlarms">
            同步报警
          </a-button>
          <a-button type="primary" :loading="loading" @click="loadData">
            刷新数据
          </a-button>
          <a-button type="primary" ghost @click="openMonitorConsole">
            打开监控台
          </a-button>
          <span class="auto-sync-status">
            {{ autoRefreshing ? '正在刷新监控数据' : lastAutoRefreshAt ? `自动刷新 ${lastAutoRefreshAt}` : '等待数据刷新' }}
          </span>
        </div>
      </div>
      <div class="hero-status">
        <span>当前车辆</span>
        <strong>{{ selectedVehicle?.plateNo || '未选择' }}</strong>
        <small>{{ selectedLocation?.locationTime || '暂无定位时间' }}</small>
      </div>
    </section>

    <a-alert v-if="errorMessage" mb-4 type="error" show-icon :message="errorMessage" closable @close="errorMessage = ''" />

    <SummaryCards :cards="monitorStats" compact />

    <section class="monitor-workspace">
      <aside class="vehicle-panel">
        <div class="panel-head">
          <div>
            <h2>车辆列表</h2>
            <p>{{ filteredVehicles.length }} 辆符合条件</p>
          </div>
        </div>
        <div class="vehicle-filters">
          <a-input v-model:value="keyword" allow-clear placeholder="搜索车牌号/司机" />
          <a-segmented v-model:value="onlineFilter" block :options="[{ label: '全部', value: 'all' }, { label: '在线', value: 'online' }, { label: '离线', value: 'offline' }]" />
        </div>
        <a-list class="vehicle-list" :data-source="filteredVehicles" :loading="loading">
          <template #renderItem="{ item }">
            <a-list-item class="vehicle-item" :class="{ active: selectedVehicleId === item.vehicleId }" @click="selectVehicle(item.vehicleId)">
              <div class="vehicle-row">
                <div>
                  <strong>{{ item.plateNo }}</strong>
                  <p class="vehicle-location" :title="vehicleLocationLabel(item.vehicleId)">
                    {{ vehicleLocationLabel(item.vehicleId) }}
                  </p>
                  <p class="vehicle-meta">
                    {{ vehicleOrderLabel(item) }}
                  </p>
                </div>
                <a-tag :color="statusColor(item.onlineStatus)">
                  {{ onlineStatusLabel(item.onlineStatus) }}
                </a-tag>
              </div>
            </a-list-item>
          </template>
        </a-list>
      </aside>

      <main class="map-panel">
        <div class="panel-head map-head">
          <div>
            <h2>实时位置</h2>
            <p>{{ locations.length }} 个定位点 · {{ geofences.length }} 个电子围栏</p>
          </div>
          <div class="map-legend">
            <span><i class="legend-dot online" />在线</span>
            <span><i class="legend-dot offline" />离线</span>
            <span><i class="legend-dot alarm" />异常</span>
            <span><i class="legend-direction" />行驶方向</span>
          </div>
        </div>
        <div class="gps-map-shell">
          <div ref="mapContainer" class="gps-map" />
          <div v-if="loading || autoRefreshing" class="map-sync-indicator">
            <span class="sync-pulse" />
            {{ autoRefreshing ? '正在刷新车辆位置' : '正在加载地图数据' }}
          </div>
          <a-empty v-if="!loading && !locations.length" class="map-empty" description="暂无可用定位数据" />
        </div>
      </main>

      <aside class="detail-panel">
        <div class="panel-head">
          <div>
            <h2>定位详情</h2>
            <p>{{ selectedVehicle?.currentOrderNo || '暂无执行订单' }}</p>
          </div>
          <a-tag v-if="selectedLocation" :color="statusColor(selectedLocation.onlineStatus)">
            {{ onlineStatusLabel(selectedLocation.onlineStatus) }}
          </a-tag>
        </div>

        <template v-if="selectedVehicle && selectedLocation">
          <div class="vehicle-focus">
            <strong>{{ selectedVehicle.plateNo }}</strong>
            <span>{{ selectedVehicle.driverName }} · {{ selectedLocation.speed }} km/h</span>
          </div>
          <div class="detail-grid">
            <div>
              <span>定位时间</span>
              <b>{{ selectedLocation.locationTime }}</b>
            </div>
            <div>
              <span>点火状态</span>
              <b>{{ accStatusLabel(selectedLocation.accStatus) }}</b>
            </div>
            <div>
              <span>设备编号</span>
              <b>{{ selectedDevice?.deviceNo || '未绑定' }}</b>
            </div>
            <div>
              <span>最近报警</span>
              <b>{{ selectedRecentAlarm?.alarmType || '无' }}</b>
            </div>
          </div>
          <div class="detail-block">
            <span>位置</span>
            <p>{{ displayLocationAddress(selectedLocation) }}</p>
          </div>
          <a-space direction="vertical" w-full>
            <a-button block type="primary" @click="loadTrack(selectedVehicle.vehicleId)">
              查看轨迹
            </a-button>
            <a-button block @click="activeTab = 'alarms'">
              处理报警
            </a-button>
          </a-space>
        </template>
        <a-empty v-else description="请选择车辆查看定位详情" />
      </aside>
    </section>

    <a-card :bordered="false" class="tabs-card">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="console" tab="监控台">
          <section class="provider-console">
            <div class="console-head">
              <div>
                <h2>车辆监控控制台</h2>
                <p>{{ locationConsoleRows.length }} 辆车有最新定位数据</p>
              </div>
              <a-space>
                <a-button @click="exportLocations">
                  导出至 Excel
                </a-button>
                <a-button @click="openMonitorConsole">
                  打开 808GPS
                </a-button>
              </a-space>
            </div>
            <a-tabs v-model:active-key="consoleTab" class="console-tabs">
              <a-tab-pane key="positions" tab="位置监控">
                <a-table
                  row-key="id"
                  size="middle"
                  :columns="locationConsoleColumns"
                  :data-source="locationConsoleRows"
                  :pagination="{ defaultPageSize: 20, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true, showTotal: (total: number) => `共 ${total} 辆` }"
                  :scroll="{ x: locationConsoleScrollX, y: 520 }"
                  :row-class-name="(record: GpsLocationLatest) => selectedVehicleId === record.vehicleId ? 'location-row-selected' : ''"
                  :custom-row="locationRowProps"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.dataIndex === 'action'">
                      <a-button type="link" size="small" @click.stop="selectVehicle(record.vehicleId)">
                        定位
                      </a-button>
                    </template>
                    <template v-else-if="column.dataIndex === 'plateNo'">
                      <a class="location-plate" @click.stop="selectVehicle(record.vehicleId)">{{ record.plateNo }}</a>
                    </template>
                    <template v-else-if="column.dataIndex === 'speedDirection'">
                      <span :class="record.speed > 0 ? 'location-moving' : 'location-stopped'">{{ record.speedDirection }}</span>
                    </template>
                    <template v-else-if="column.dataIndex === 'onlineStatus'">
                      <a-tag :color="statusColor(record.onlineStatus)">
                        {{ onlineStatusLabel(record.onlineStatus) }}
                      </a-tag>
                    </template>
                    <template v-else>
                      <a-tooltip :title="displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex))">
                        <span class="cell-ellipsis">{{ displayBusinessTableValue(getBusinessTableValue(record, column.dataIndex)) }}</span>
                      </a-tooltip>
                    </template>
                  </template>
                </a-table>
              </a-tab-pane>
              <a-tab-pane key="media" tab="媒体文件">
                <a-empty description="暂无车辆媒体文件" />
              </a-tab-pane>
              <a-tab-pane key="commands" tab="指令追踪">
                <a-table row-key="id" :columns="operationLogTableColumns" :data-source="operationLogs" :pagination="{ defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }" :scroll="{ x: operationLogTableScrollX }" />
              </a-tab-pane>
            </a-tabs>
          </section>
        </a-tab-pane>

        <a-tab-pane key="tracks" tab="轨迹回放">
          <GpsTrackPanel
            v-model:selected-vehicle-id="selectedVehicleId"
            v-model:track-range="trackRange"
            v-model:play-speed="playSpeed"
            :vehicles="vehicles"
            :points="trackClassifiedPoints"
            :columns="trackTableColumns"
            :scroll-x="trackTableScrollX"
            :current-point="currentTrackPoint"
            :loading="trackLoading"
            :playing="playing"
            :last-sync-at="lastAlarmSyncAt"
            :status-color="statusColor"
            :point-type-label="pointTypeLabel"
            :acc-status-label="accStatusLabel"
            @load="loadTrack()"
            @play="playTrack"
            @pause="pauseTrack"
          />
        </a-tab-pane>

        <a-tab-pane key="alarms" tab="报警记录">
          <GpsAlarmPanel
            v-model:alarm-type-filter="alarmTypeFilter"
            v-model:alarm-status-filter="alarmStatusFilter"
            v-model:alarm-remark="alarmRemark"
            :alarms="filteredAlarms"
            :columns="alarmTableColumns"
            :scroll-x="alarmTableScrollX"
            :status-color="statusColor"
            :alarm-level-label="alarmLevelLabel"
            :alarm-status-label="alarmStatusLabel"
            @select-vehicle="selectVehicle"
            @handle-alarm="handleAlarmRecord"
          />
        </a-tab-pane>

        <a-tab-pane key="fences" tab="电子围栏">
          <GpsGeofencePanel
            :form="fenceForm"
            :fences="geofences"
            :vehicles="vehicles"
            :routes="routeOptions"
            :judgments="fenceJudgments"
            :selected-location="selectedLocation"
            :saving="fenceSaving"
            @route-change="applyRouteFenceDefaults"
            @use-selected-location="useSelectedVehicleLocation"
            @save="saveFence"
            @reset="resetFenceForm"
            @focus="focusFence"
            @edit="editFence"
          />
        </a-tab-pane>

        <a-tab-pane key="devices" tab="设备绑定">
          <GpsDevicePanel
            v-model:selected-vehicle-id="selectedVehicleId"
            v-model:selected-device-id="selectedDeviceId"
            :vehicles="vehicles"
            :devices="devices"
            :columns="deviceTableColumns"
            :scroll-x="deviceTableScrollX"
            :status-color="statusColor"
            :online-status-label="onlineStatusLabel"
            :provider-label="providerLabel"
            @bind="bindDevice"
          />
        </a-tab-pane>

        <a-tab-pane key="providers" tab="服务商配置">
          <GpsProviderPanel :configs="providerConfigs" :provider-label="providerLabel" :boolean-label="booleanLabel" />
        </a-tab-pane>

        <a-tab-pane key="logs" tab="同步/操作日志">
          <GpsLogPanel
            :sync-logs="syncLogs"
            :operation-logs="operationLogs"
            :sync-columns="syncLogTableColumns"
            :operation-columns="operationLogTableColumns"
            :sync-scroll-x="syncLogTableScrollX"
            :operation-scroll-x="operationLogTableScrollX"
            :status-color="statusColor"
            :sync-status-label="syncStatusLabel"
            :provider-label="providerLabel"
            :sync-type-label="syncTypeLabel"
            :target-type-label="targetTypeLabel"
          />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </page-container>
</template>

<style scoped>
.monitor-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 16px;
}

.hero-main,
.hero-status,
.vehicle-panel,
.map-panel,
.detail-panel,
.tabs-card {
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border-subtle, #e8edf5);
  border-radius: 8px;
}

.hero-main {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
}

.hero-title-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.hero-title-row h1 {
  margin: 0;
  color: var(--admin-text, #1f2937);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
}

.hero-title-row p,
.panel-head p {
  margin: 5px 0 0;
  color: var(--admin-muted, #64748b);
  font-size: 13px;
}

.hero-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.provider-select {
  width: 160px;
}

.auto-sync-status {
  color: var(--admin-muted, #64748b);
  font-size: 12px;
  white-space: nowrap;
}

.hero-status {
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 18px;
}

.hero-status span,
.monitor-stat span,
.detail-grid span,
.detail-block span {
  color: var(--admin-muted, #64748b);
  font-size: 12px;
}

.hero-status strong {
  color: var(--admin-text, #1f2937);
  font-size: 24px;
  line-height: 1.1;
}

.hero-status small,
.monitor-stat small {
  color: var(--admin-muted, #64748b);
  font-size: 12px;
}

.monitor-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.monitor-stat {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  background: var(--admin-surface, #fff);
  border: 1px solid var(--admin-border-subtle, #e8edf5);
  border-radius: 8px;
}

.monitor-stat strong {
  color: var(--admin-text, #1f2937);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.monitor-stat.is-success strong {
  color: var(--admin-success, #16a34a);
}

.monitor-stat.is-warning strong {
  color: var(--admin-warning, #d97706);
}

.monitor-stat.is-danger strong {
  color: var(--admin-danger, #dc2626);
}

.monitor-workspace {
  display: grid;
  grid-template-columns: 300px minmax(420px, 1fr) 310px;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 16px;
}

.vehicle-panel,
.map-panel,
.detail-panel {
  min-width: 0;
  padding: 16px;
}

.map-panel {
  display: flex;
  flex-direction: column;
}

.panel-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel-head h2 {
  margin: 0;
  color: var(--admin-text, #1f2937);
  font-size: 16px;
  font-weight: 700;
}

.vehicle-filters {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.vehicle-list {
  max-height: 480px;
  overflow: auto;
}

.vehicle-item {
  padding: 6px 8px !important;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.vehicle-item.active {
  background: rgba(22, 119, 255, 0.08);
}

.vehicle-item:hover {
  background: #f5f8fc;
}

.vehicle-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
}

.vehicle-row strong {
  color: var(--admin-text, #1f2937);
  font-size: 14px;
}

.vehicle-location,
.vehicle-meta {
  margin: 4px 0 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vehicle-location {
  color: var(--admin-text-secondary, #475569);
}

.vehicle-meta {
  margin-top: 2px;
  color: var(--admin-muted, #64748b);
  font-size: 11px;
}

.map-head {
  align-items: center;
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--admin-muted, #64748b);
  font-size: 12px;
}

.map-legend span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.online {
  background: #1677ff;
}

.legend-dot.offline {
  background: #8c8c8c;
}

.legend-dot.alarm {
  background: #ff4d4f;
}

.legend-direction {
  width: 0;
  height: 0;
  border-right: 5px solid transparent;
  border-bottom: 10px solid var(--admin-primary);
  border-left: 5px solid transparent;
}

.gps-map-shell {
  position: relative;
  flex: 1;
  min-height: 460px;
  overflow: hidden;
  border: 1px solid var(--admin-border);
  border-radius: 8px;
  background: #eef2f6;
}

.gps-map {
  position: absolute;
  inset: 0;
  min-height: 460px;
}

.map-sync-indicator {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 7px 10px;
  color: var(--admin-text-secondary);
  font-size: 12px;
  background: rgb(255 255 255 / 94%);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgb(15 23 42 / 12%);
}

.sync-pulse {
  width: 7px;
  height: 7px;
  background: var(--admin-primary);
  border-radius: 50%;
  animation: sync-pulse 1.2s ease-in-out infinite;
}

.map-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  margin: 0;
  transform: translate(-50%, -50%);
}

@keyframes sync-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.75);
  }
}

.detail-panel {
  display: flex;
  flex-direction: column;
}

.vehicle-focus {
  display: grid;
  gap: 5px;
  padding: 14px;
  margin-bottom: 12px;
  background: #f7faff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
}

.vehicle-focus strong {
  color: var(--admin-text, #1f2937);
  font-size: 20px;
  line-height: 1.2;
}

.vehicle-focus span {
  color: var(--admin-muted, #64748b);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.detail-grid div,
.detail-block {
  min-width: 0;
  padding: 10px;
  background: #f8fafc;
  border-radius: 6px;
}

.detail-grid b {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--admin-text, #1f2937);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-block {
  margin-bottom: 10px;
}

.detail-block p {
  margin: 5px 0 0;
  color: var(--admin-text, #1f2937);
  font-size: 13px;
  line-height: 1.55;
}

.tabs-card {
  overflow: hidden;
}

.tabs-card :deep(.ant-card-body) {
  padding: 18px 20px 20px;
}

.provider-console {
  display: grid;
  gap: 14px;
}

.console-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 10px;
}

.console-tabs :deep(.ant-table-row) {
  cursor: pointer;
}

.console-tabs :deep(.location-row-selected > td) {
  background: #e6f4ff !important;
}

.location-plate {
  font-weight: 650;
}

.location-moving {
  color: var(--admin-success, #16a34a);
  font-variant-numeric: tabular-nums;
}

.location-stopped {
  color: #7c8b00;
  font-variant-numeric: tabular-nums;
}

.console-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}

.console-head h2 {
  margin: 0;
  color: var(--admin-text, #1f2937);
  font-size: 16px;
  font-weight: 700;
}

.console-head p {
  margin: 5px 0 0;
  overflow: hidden;
  color: var(--admin-muted, #64748b);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitor-frame {
  width: 100%;
  min-height: 680px;
  border: 1px solid var(--admin-border-subtle, #e8edf5);
  border-radius: 8px;
}

@media screen and (max-width: 1400px) {
  .monitor-workspace {
    grid-template-columns: 280px minmax(360px, 1fr);
  }

  .detail-panel {
    grid-column: 1 / -1;
  }

  .detail-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media screen and (max-width: 992px) {
  .monitor-hero,
  .monitor-workspace {
    grid-template-columns: 1fr;
  }

  .monitor-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .vehicle-list {
    max-height: 320px;
  }

  .detail-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media screen and (max-width: 640px) {
  .hero-title-row,
  .map-head,
  .console-head {
    display: grid;
  }

  .hero-toolbar .ant-btn,
  .provider-select {
    width: 100%;
  }

  .auto-sync-status {
    width: 100%;
    text-align: center;
  }

  .monitor-stats,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .gps-map-shell,
  .gps-map {
    min-height: 360px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sync-pulse {
    animation: none;
  }
}
</style>
