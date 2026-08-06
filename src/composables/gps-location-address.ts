import type { GpsGeofence, GpsLocationLatest } from '~@/api/gps'
import { reactive } from 'vue'
import { formatBigDataCloudAddress, sanitizeGpsDisplayAddress } from '~@/utils/gps-address'

const storageKey = 'gps:chinese-address-cache:v1'
const addressCache = reactive<Record<string, string>>(loadCache())
const pendingKeys = new Set<string>()
const queue: GpsLocationLatest[] = []
let activeWorkers = 0

function loadCache() {
  if (typeof localStorage === 'undefined')
    return {}
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}')
  }
  catch {
    return {}
  }
}

function coordinateKey(location: Pick<GpsLocationLatest, 'longitude' | 'latitude'>) {
  return `${Number(location.latitude).toFixed(3)},${Number(location.longitude).toFixed(3)}`
}

function coordinateText(location: Pick<GpsLocationLatest, 'longitude' | 'latitude'>) {
  return `${Number(location.longitude).toFixed(6)}, ${Number(location.latitude).toFixed(6)}`
}

function distanceMeters(location: Pick<GpsLocationLatest, 'longitude' | 'latitude'>, center: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180
  const deltaLatitude = radians(location.latitude - center[1])
  const deltaLongitude = radians(location.longitude - center[0])
  const latitude1 = radians(center[1])
  const latitude2 = radians(location.latitude)
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function findNearbyGpsFence(location: GpsLocationLatest | undefined, fences: GpsGeofence[]) {
  if (!location)
    return undefined
  return fences
    .filter(fence => fence.enabled && fence.shape === 'circle' && fence.center && fence.radius)
    .map(fence => ({ fence, distance: distanceMeters(location, fence.center!) }))
    .filter(item => item.distance <= Number(item.fence.radius))
    .sort((a, b) => a.distance - b.distance)[0]
    ?.fence
}

interface GpsFenceRoute {
  code?: string
  name?: string
  loadingAddress?: string
  unloadingAddress?: string
}

export type GpsRouteStage = 'loading' | 'unloading'

function normalizeFenceRouteToken(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().replace(/[\s·・,，/至到—–-]+/g, '').toLowerCase()
}

function endpointMatchesFenceAddress(endpoint: string, fenceAddress: string) {
  if (!endpoint || !fenceAddress)
    return false
  return endpoint === fenceAddress
    || (endpoint.length >= 4 && fenceAddress.includes(endpoint))
    || (fenceAddress.length >= 4 && endpoint.includes(fenceAddress))
}

export function filterGpsFencesForRoute(fences: GpsGeofence[], route: GpsFenceRoute | undefined) {
  if (!route)
    return []

  const routeCode = normalizeFenceRouteToken(route.code)
  const routeName = normalizeFenceRouteToken(route.name)
  const loadingAddress = normalizeFenceRouteToken(route.loadingAddress)
  const unloadingAddress = normalizeFenceRouteToken(route.unloadingAddress)

  return fences.filter((fence) => {
    const fenceRouteCode = normalizeFenceRouteToken(fence.routeCode)
    const fenceRouteName = normalizeFenceRouteToken(fence.routeName)
    if (routeCode && fenceRouteCode && routeCode === fenceRouteCode)
      return true
    if (routeName && fenceRouteName && routeName === fenceRouteName)
      return true

    const expectedAddress = fence.routeStage === 'loading' ? loadingAddress : fence.routeStage === 'unloading' ? unloadingAddress : ''
    return endpointMatchesFenceAddress(expectedAddress, normalizeFenceRouteToken(fence.address))
  })
}

function mostSpecificAdministrativePlace(value: string) {
  const matches = [...value.normalize('NFKC').matchAll(/([\u4E00-\u9FFF]{2,12})(?:特别行政区|自治区|自治州|地区|街道|[省市县区旗镇乡])/g)]
  return normalizeFenceRouteToken(matches.at(-1)?.[1])
}

function endpointLocationScore(locationAddress: string, endpointAddress: string) {
  const location = normalizeFenceRouteToken(locationAddress)
  const endpoint = normalizeFenceRouteToken(endpointAddress)
  if (!location || !endpoint)
    return 0
  if (endpoint.length >= 3 && location.includes(endpoint))
    return 100 + endpoint.length
  if (location.length >= 3 && endpoint.includes(location))
    return 100 + location.length

  // Reverse geocoding normally returns city/county/town. Only the most
  // specific administrative place is safe enough to distinguish nearby stops.
  const administrativePlace = mostSpecificAdministrativePlace(locationAddress)
  if (administrativePlace.length >= 2 && endpoint.includes(administrativePlace))
    return 80 + administrativePlace.length
  return 0
}

export function resolveGpsRouteStageByAddress(locationAddress: string, route: Pick<GpsFenceRoute, 'loadingAddress' | 'unloadingAddress'>): GpsRouteStage | undefined {
  const loadingScore = endpointLocationScore(locationAddress, String(route.loadingAddress ?? ''))
  const unloadingScore = endpointLocationScore(locationAddress, String(route.unloadingAddress ?? ''))
  if (!loadingScore && !unloadingScore)
    return undefined
  if (loadingScore === unloadingScore)
    return undefined
  return loadingScore > unloadingScore ? 'loading' : 'unloading'
}

function nearbyFenceName(location: GpsLocationLatest, fences: GpsGeofence[]) {
  return findNearbyGpsFence(location, fences)?.name?.replace(/(?:装车|卸车)?围栏$/, '') || ''
}

export function displayGpsLocation(location: GpsLocationLatest | undefined, fences: GpsGeofence[] = []) {
  if (!location)
    return ''
  return nearbyFenceName(location, fences)
    || addressCache[coordinateKey(location)]
    || sanitizeGpsDisplayAddress(location.address)
    || coordinateText(location)
}

async function geocodeWorker() {
  activeWorkers++
  while (queue.length) {
    const location = queue.shift()!
    const key = coordinateKey(location)
    try {
      const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), localityLanguage: 'zh' })
      let address = ''
      try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`)
        address = response.ok ? formatBigDataCloudAddress(await response.json() as Record<string, any>) : ''
      }
      catch {
        address = ''
      }
      if (!address) {
        const osmQuery = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), format: 'jsonv2', 'accept-language': 'zh-CN' })
        const osmResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?${osmQuery}`)
        if (osmResponse.ok) {
          const osmData = await osmResponse.json() as Record<string, any>
          address = sanitizeGpsDisplayAddress(String(osmData.display_name ?? '').replace(/,/g, ' '))
        }
      }
      if (address) {
        addressCache[key] = address
        localStorage.setItem(storageKey, JSON.stringify(addressCache))
      }
    }
    catch {
      // The coordinate remains visible if reverse geocoding is unavailable.
    }
    pendingKeys.delete(key)
  }
  activeWorkers--
}

export function queueGpsChineseAddresses(locations: GpsLocationLatest[]) {
  for (const location of locations) {
    const key = coordinateKey(location)
    if (addressCache[key] || pendingKeys.has(key))
      continue
    pendingKeys.add(key)
    queue.push(location)
  }
  const workersToStart = Math.min(6 - activeWorkers, queue.length)
  for (let index = 0; index < workersToStart; index++)
    void geocodeWorker()
}
