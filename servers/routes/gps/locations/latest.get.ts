import { defineEventHandler, getQuery } from 'h3'
import { gpsLocationService } from '../../../services/gps/location-service'
import { getTrustedAccessQuery } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  return {
    code: 200,
    msg: '获取成功',
    data: await gpsLocationService.listLatest({ ...getQuery(event), ...getTrustedAccessQuery(event) }),
  }
})
