import { defineEventHandler } from 'h3'
import { gpsLocationService } from '../../../services/gps/location-service'
import { getTrustedAccessQuery } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const access = getTrustedAccessQuery(event)
  return {
    code: 200,
    msg: '获取成功',
    data: (await gpsLocationService.getVehicleStatuses()).filter(item => access.role === 'ADMIN' || String(item.ownerUserId) === String(access.userId)),
  }
})
