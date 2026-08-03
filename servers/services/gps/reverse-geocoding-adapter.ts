import process from 'node:process'
import { Converter } from 'opencc-js'

const reverseGeocodeCache = new Map<string, string>()
const toSimplifiedChinese = Converter({ from: 'tw', to: 'cn' })
const standaloneCityAliases = new Set([
  '北京',
  '上海',
  '天津',
  '重庆',
  '广州',
  '深圳',
  '成都',
  '昆明',
  '西安',
  '武汉',
  '南京',
  '杭州',
])
const qinghaiHaixiPrefixPattern = /^青海省(?:海西蒙古族藏族自治州|海西州)/

export function sanitizeGpsAddress(address: string) {
  const parts = String(address || '').trim().replace(qinghaiHaixiPrefixPattern, '').trim().split(/\s+/).filter(Boolean)
  const routeSeparatorIndex = parts.findIndex((part, index) =>
    /^[-–—至]$/.test(part)
    && standaloneCityAliases.has(parts[index - 1])
    && standaloneCityAliases.has(parts[index + 1]),
  )
  if (routeSeparatorIndex > 0)
    parts.splice(routeSeparatorIndex - 1, 3)
  const confirmedCity = parts.find(part => part.endsWith('市'))
  if (!confirmedCity)
    return parts.join(' ')
  return parts
    .filter(value => !standaloneCityAliases.has(value) || `${value}市` === confirmedCity)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' ')
}

export function withSanitizedAddress<T extends { address?: string }>(item: T): T {
  return { ...item, address: sanitizeGpsAddress(item.address || '') }
}

export function formatGpsLocation(data: Record<string, any>) {
  const administrative = Array.isArray(data.localityInfo?.administrative) ? data.localityInfo.administrative : []
  const mostSpecificAdministrative = [...administrative]
    .filter(item => item?.name && Number(item.adminLevel) >= 6)
    .sort((a, b) => Number(b.adminLevel) - Number(a.adminLevel))[0]
    ?.name
  const location = String(data.locality || mostSpecificAdministrative || '').trim()
  return location ? toSimplifiedChinese(location) : ''
}

export function formatPhotonLocation(data: Record<string, any>) {
  const properties = data.features?.[0]?.properties ?? {}
  const parts = [
    properties.city,
    properties.district || properties.county,
    properties.town,
    properties.locality || properties.village,
    properties.street,
    properties.name,
  ]
    .map((value: unknown) => toSimplifiedChinese(String(value ?? '').trim()))
    .filter((value: string) => /[\u3400-\u9FFF]/u.test(value))
    .filter((value: string, index: number, values: string[]) => value && values.indexOf(value) === index)
    .filter((value: string) => !/[省州]$/.test(value))
  return [...parts.filter(part => part.endsWith('市')), ...parts.filter(part => !part.endsWith('市'))].join(' ')
}

export function mergeReverseGeocodeLocation(cityValue: unknown, photonAddress: string, fallbackLocation = '') {
  const city = toSimplifiedChinese(String(cityValue ?? '').trim())
  const photon = String(photonAddress ?? '').trim()
  if (!photon)
    return [city, fallbackLocation].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' ')

  const photonCity = photon.split(/\s+/).find(part => part.endsWith('市'))
  if (city && photonCity && city !== photonCity)
    return photon
  return sanitizeGpsAddress([city, ...photon.split(/\s+/)].filter(Boolean).join(' '))
}

export function validPreviousAddress(address?: string) {
  const value = sanitizeGpsAddress(String(address ?? '').trim())
  return value
    && !/^(?:位置解析中|位置暂不可用|定位信息待更新|精确坐标)/.test(value)
    && !/^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,2}(?:\.\d+)?$/.test(value)
    ? value
    : ''
}

export function shouldRepairGpsAddress(currentAddress?: string, resolvedAddress?: string) {
  return !validPreviousAddress(currentAddress) && Boolean(validPreviousAddress(resolvedAddress))
}

export function fallbackGpsLocation(previousAddress?: string, longitude?: number, latitude?: number) {
  const previous = validPreviousAddress(previousAddress)
  if (previous)
    return previous.endsWith('（最后已知）') ? previous.slice(0, -6) : previous
  if (Number.isFinite(longitude) && Number.isFinite(latitude))
    return `${Number(longitude).toFixed(6)}, ${Number(latitude).toFixed(6)}`
  return '定位信息待更新'
}

async function resolveOsmAddress(longitude: number, latitude: number) {
  try {
    const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', 'accept-language': 'zh-CN' })
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
      headers: { 'User-Agent': 'enterprise-system/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok)
      return ''
    const data = await response.json() as Record<string, any>
    return sanitizeGpsAddress(String(data.display_name ?? '').replaceAll(',', ' '))
  }
  catch {
    return ''
  }
}

export async function resolveAddress(longitude: number, latitude: number, previousAddress?: string) {
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`
  const cached = reverseGeocodeCache.get(cacheKey)
  if (cached)
    return cached

  const amapKey = process.env.AMAP_WEB_SERVICE_KEY?.trim()
  if (amapKey) {
    try {
      const query = new URLSearchParams({ key: amapKey, location: `${longitude.toFixed(6)},${latitude.toFixed(6)}`, extensions: 'base', output: 'JSON' })
      const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${query}`, { signal: AbortSignal.timeout(8_000) })
      if (response.ok) {
        const data = await response.json() as Record<string, any>
        const address = sanitizeGpsAddress(String(data.regeocode?.formatted_address ?? ''))
        if (data.status === '1' && address) {
          reverseGeocodeCache.set(cacheKey, address)
          return address
        }
      }
    }
    catch {
      // Continue through the fallback providers.
    }
  }

  let photonAddress = ''
  try {
    const photonQuery = new URLSearchParams({ lon: String(longitude), lat: String(latitude) })
    const photonResponse = await fetch(`https://photon.komoot.io/reverse?${photonQuery}`, {
      headers: { 'User-Agent': 'enterprise-system/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    if (photonResponse.ok)
      photonAddress = formatPhotonLocation(await photonResponse.json() as Record<string, any>)

    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: 'zh' })
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, {
      headers: { 'User-Agent': 'enterprise-system/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok)
      throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as Record<string, any>
    const address = mergeReverseGeocodeLocation(data.city, photonAddress, formatGpsLocation(data))
      .split(' ')
      .filter(value => !/[省州]$/.test(value))
      .join(' ')
    if (!address) {
      const osmAddress = await resolveOsmAddress(longitude, latitude)
      if (osmAddress) {
        reverseGeocodeCache.set(cacheKey, osmAddress)
        return osmAddress
      }
      throw new Error('地址为空')
    }
    reverseGeocodeCache.set(cacheKey, address)
    return address
  }
  catch {
    const osmAddress = await resolveOsmAddress(longitude, latitude)
    const fallback = osmAddress || photonAddress || fallbackGpsLocation(previousAddress, longitude, latitude)
    if (osmAddress || photonAddress)
      reverseGeocodeCache.set(cacheKey, fallback)
    return fallback
  }
}

export async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = Array.from({ length: items.length })
  let nextIndex = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }))
  return results
}
