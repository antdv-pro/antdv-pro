export interface GeofenceRecord {
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

export interface GeofenceVehicleRecord {
  id: string
  geofenceId: string
  vehicleId: string
  createdAt: string
}

interface GeofenceState {
  geofences: GeofenceRecord[]
  geofenceVehicles: GeofenceVehicleRecord[]
  vehicles: Array<{ vehicleId: string }>
}

interface OperatorInput { operatorId?: string | number, operatorName?: string }
export type SaveGeofenceInput = Partial<GeofenceRecord> & OperatorInput
export type BindGeofenceVehiclesInput = { geofenceId: string, vehicleIds: string[] } & OperatorInput

function isValidLngLat(point: [number, number]) {
  return point.length === 2 && point.every(Number.isFinite)
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90
}

function operation(input: OperatorInput, action: string, targetId: string, message: string) {
  return {
    action,
    operatorId: input.operatorId ?? 'system',
    operatorName: input.operatorName ?? '系统',
    targetType: 'gps_geofence',
    targetId,
    message,
    rawData: input,
  }
}

export function withGeofenceVehicles(fence: GeofenceRecord, bindings: GeofenceVehicleRecord[]) {
  return { ...fence, vehicles: bindings.filter(item => item.geofenceId === fence.id) }
}

export function saveGeofence(
  state: GeofenceState,
  input: SaveGeofenceInput,
  dependencies: { nextId: () => string, now: () => string },
) {
  const existing = input.id ? state.geofences.find(item => item.id === input.id) : undefined
  if (input.id && !existing)
    throw new Error('电子围栏不存在')
  const shape = input.shape ?? existing?.shape ?? 'circle'
  if (shape === 'circle') {
    const center = input.center ?? existing?.center ?? [94.91, 36.4]
    const radius = input.radius ?? existing?.radius ?? 1500
    if (!center || !isValidLngLat(center))
      throw new Error('圆形围栏中心坐标不合法')
    if (!Number.isFinite(radius) || radius <= 0)
      throw new Error('圆形围栏半径必须大于 0')
  }
  else {
    const points = input.points ?? existing?.points
    if (!points || points.length < 3 || points.some(point => !isValidLngLat(point)))
      throw new Error('多边形围栏至少需要 3 个有效坐标点')
  }

  const timestamp = dependencies.now()
  if (existing) {
    Object.assign(existing, { ...input, updatedAt: timestamp })
    return { fence: existing, operation: operation(input, 'update-geofence', existing.id, `编辑电子围栏 ${existing.name}`) }
  }
  const fence: GeofenceRecord = {
    id: dependencies.nextId(),
    name: input.name ?? '未命名围栏',
    address: input.address,
    shape,
    center: input.center ?? [94.91, 36.4],
    radius: input.radius ?? 1500,
    points: input.points,
    routeCode: input.routeCode,
    routeName: input.routeName,
    routeStage: input.routeStage,
    enabled: input.enabled ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  state.geofences.unshift(fence)
  return { fence, operation: operation(input, 'create-geofence', fence.id, `创建电子围栏 ${fence.name}`) }
}

export function bindGeofenceVehicles(
  state: GeofenceState,
  input: BindGeofenceVehiclesInput,
  dependencies: { nextId: () => string, now: () => string },
) {
  const fence = state.geofences.find(item => item.id === input.geofenceId)
  if (!fence)
    throw new Error('电子围栏不存在')
  const vehicleIds = [...new Set(input.vehicleIds)]
  const knownIds = new Set(state.vehicles.map(item => item.vehicleId))
  if (vehicleIds.some(vehicleId => !knownIds.has(vehicleId)))
    throw new Error('围栏绑定包含不存在的车辆')
  state.geofenceVehicles = state.geofenceVehicles.filter(item => item.geofenceId !== input.geofenceId)
  state.geofenceVehicles.push(...vehicleIds.map(vehicleId => ({
    id: dependencies.nextId(),
    geofenceId: input.geofenceId,
    vehicleId,
    createdAt: dependencies.now(),
  })))
  return {
    fence: withGeofenceVehicles(fence, state.geofenceVehicles),
    operation: operation(input, 'bind-geofence-vehicles', fence.id, `围栏 ${fence.name} 绑定 ${vehicleIds.length} 辆车`),
  }
}
