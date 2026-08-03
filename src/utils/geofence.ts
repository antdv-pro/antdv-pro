export interface GeofenceGeometry {
  shape: 'circle' | 'polygon'
  center?: [number, number]
  radius?: number
  points?: Array<[number, number]>
}

export const GEOFENCE_LOCATION_MAX_AGE_MS = 30 * 60 * 1000

function timestampMs(value: string | undefined) {
  if (!value)
    return Number.NaN
  return Date.parse(value.includes('T') ? value : value.replace(' ', 'T'))
}

export function isGeofenceLocationFresh(locationTime: string | undefined, referenceTime = Date.now(), maxAgeMs = GEOFENCE_LOCATION_MAX_AGE_MS) {
  const locationTimeMs = timestampMs(locationTime)
  return Number.isFinite(locationTimeMs)
    && locationTimeMs <= referenceTime
    && referenceTime - locationTimeMs <= maxAgeMs
}

export function isLocationTimeAfter(candidateTime: string | undefined, previousTime: string | undefined) {
  const candidateTimeMs = timestampMs(candidateTime)
  const previousTimeMs = timestampMs(previousTime)
  return Number.isFinite(candidateTimeMs) && (!Number.isFinite(previousTimeMs) || candidateTimeMs > previousTimeMs)
}

function distanceMeters(a: [number, number], b: [number, number]) {
  const toRadians = (value: number) => value * Math.PI / 180
  const earthRadius = 6371008.8
  const deltaLatitude = toRadians(b[1] - a[1])
  const deltaLongitude = toRadians(b[0] - a[0])
  const latitude1 = toRadians(a[1])
  const latitude2 = toRadians(b[1])
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function isPointInGeofence(point: [number, number], fence: GeofenceGeometry) {
  if (fence.shape === 'circle')
    return Boolean(fence.center && fence.radius && distanceMeters(point, fence.center) <= fence.radius)

  const polygon = fence.points ?? []
  if (polygon.length < 3)
    return false
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, y] = polygon[index]
    const [previousX, previousY] = polygon[previous]
    const intersects = (y > point[1]) !== (previousY > point[1])
      && point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x
    if (intersects)
      inside = !inside
  }
  return inside
}

export function getGeofenceTransition(previous: [number, number] | undefined, current: [number, number], fence: GeofenceGeometry) {
  if (!previous)
    return undefined
  const wasInside = isPointInGeofence(previous, fence)
  const isInside = isPointInGeofence(current, fence)
  if (wasInside === isInside)
    return undefined
  return isInside ? 'enter' as const : 'exit' as const
}

export function getTimedGeofenceTransition(
  previous: { point: [number, number], locationTime: string } | undefined,
  current: { point: [number, number], locationTime: string },
  fence: GeofenceGeometry,
  maxIntervalMs = GEOFENCE_LOCATION_MAX_AGE_MS,
) {
  if (!previous)
    return undefined
  const previousTime = timestampMs(previous.locationTime)
  const currentTime = timestampMs(current.locationTime)
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime) || currentTime <= previousTime || currentTime - previousTime > maxIntervalMs)
    return undefined
  return getGeofenceTransition(previous.point, current.point, fence)
}
