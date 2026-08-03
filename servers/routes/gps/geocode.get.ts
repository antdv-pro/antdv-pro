import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { gpsGeocodingService } from '../../services/gps/geocoding-service'

export default defineEventHandler(async (event) => {
  try {
    const result = await gpsGeocodingService.geocode(getQuery(event).address)
    if (!result) {
      setResponseStatus(event, 404)
      return { code: 404, msg: '高德未找到该地址' }
    }
    return {
      code: 200,
      data: result,
      msg: result.precise ? '地址解析成功' : '仅匹配到行政区域，需人工确认',
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '高德地理编码暂时不可用'
    const status = /完整装卸车地址/.test(message) ? 400 : /尚未配置/.test(message) ? 503 : 502
    setResponseStatus(event, status)
    return { code: status, msg: message }
  }
})
