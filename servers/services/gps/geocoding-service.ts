import process from 'node:process'

const approximateLevels = new Set(['国家', '省', '市', '区县', '乡镇'])

export interface GpsGeocodeResult {
  address: string
  longitude: number
  latitude: number
  level: string
  precise: boolean
}

export const gpsGeocodingService = {
  async geocode(addressInput: unknown): Promise<GpsGeocodeResult | undefined> {
    const address = String(addressInput ?? '').trim()
    if (address.length < 3 || address.length > 255)
      throw new Error('请输入完整装卸车地址')

    const key = process.env.AMAP_WEB_SERVICE_KEY?.trim()
    if (!key)
      throw new Error('高德地理编码尚未配置')

    const params = new URLSearchParams({ address, key, output: 'JSON' })
    const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params}`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok)
      throw new Error(`高德地理编码请求失败(${response.status})`)
    const data = await response.json() as Record<string, any>
    const geocode = Array.isArray(data.geocodes) ? data.geocodes[0] : undefined
    const [longitude, latitude] = String(geocode?.location ?? '').split(',').map(Number)
    if (data.status !== '1' || !geocode || !Number.isFinite(longitude) || !Number.isFinite(latitude))
      return undefined

    const level = String(geocode.level ?? '')
    return {
      address: String(geocode.formatted_address ?? address),
      longitude,
      latitude,
      level,
      precise: Boolean(level && !approximateLevels.has(level)),
    }
  },
}
