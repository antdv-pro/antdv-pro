import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { formatBigDataCloudAddress } from '../../../src/utils/gps-address'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const latitude = Number(query.latitude)
  const longitude = Number(query.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    setResponseStatus(event, 400)
    return { code: 400, msg: '定位坐标无效' }
  }

  try {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: 'zh' })
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok)
      throw new Error(`reverse geocode returned ${response.status}`)

    const location = formatBigDataCloudAddress(await response.json() as Record<string, any>)
      .split(/\s+/)
      .slice(0, 2)
      .join(' ')
    if (!location)
      throw new Error('reverse geocode returned an empty location')

    return { code: 200, data: { location }, msg: '定位成功' }
  }
  catch (error) {
    console.error('[weather-location] reverse geocode failed', error)
    return {
      code: 200,
      data: { location: '当前位置', degraded: true },
      msg: '地点解析暂时不可用，已使用当前位置',
    }
  }
})
