import type { GpsLocationPayload, GpsProvider } from '../../services/gps/providers/types'

export interface LatestLocationRecord extends GpsLocationPayload {
  id: string
  vehicleId: string
  plateNo: string
  address: string
  provider: GpsProvider
  rawData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface TrackPointRecord extends LatestLocationRecord {
  businessType?: string
  businessId?: string
}

interface TrackState {
  latestLocations: LatestLocationRecord[]
  trackPoints: TrackPointRecord[]
}

interface TrackContext {
  vehicleId: string
  deviceId: string
  plateNo: string
  currentOrderId?: string
  provider: GpsProvider
}

export async function replaceVehicleTrack(
  state: TrackState,
  payloads: GpsLocationPayload[],
  context: TrackContext,
  dependencies: {
    nextLocationId: () => string
    nextTrackId: () => string
    now: () => string
    resolveAddress: (longitude: number, latitude: number, previousAddress?: string) => Promise<string>
  },
) {
  const previousAddress = state.latestLocations.find(item => item.vehicleId === context.vehicleId)?.address
  const points: TrackPointRecord[] = []

  for (const payload of payloads) {
    const timestamp = dependencies.now()
    const currentIndex = state.latestLocations.findIndex(item => item.deviceId === payload.deviceId)
    const current = currentIndex >= 0 ? state.latestLocations[currentIndex] : undefined
    const location: LatestLocationRecord = {
      id: current?.id ?? dependencies.nextLocationId(),
      vehicleId: context.vehicleId,
      deviceId: payload.deviceId,
      plateNo: context.plateNo,
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed: payload.speed,
      direction: payload.direction,
      altitude: payload.altitude,
      accStatus: payload.accStatus,
      onlineStatus: payload.onlineStatus,
      locationTime: payload.locationTime,
      address: '位置解析中',
      provider: context.provider,
      rawData: payload.rawData ?? {},
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    if (currentIndex >= 0)
      state.latestLocations[currentIndex] = location
    else
      state.latestLocations.push(location)

    points.push({
      ...location,
      id: dependencies.nextTrackId(),
      businessType: context.currentOrderId ? 'transport_order' : undefined,
      businessId: context.currentOrderId,
    })
  }

  await Promise.all(points.map(async (point) => {
    point.address = await dependencies.resolveAddress(point.longitude, point.latitude, previousAddress)
  }))
  state.trackPoints = [...state.trackPoints.filter(item => item.vehicleId !== context.vehicleId), ...points]
  return points
}
