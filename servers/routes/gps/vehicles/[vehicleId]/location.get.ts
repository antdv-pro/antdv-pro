import { createError, defineEventHandler, getRouterParam } from 'h3'
import { gpsLocationService } from '../../../../services/gps/location-service'
import { getTrustedAccessQuery } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  const vehicleId = getRouterParam(event, 'vehicleId')!
  const allowed = await gpsLocationService.listVehicles(getTrustedAccessQuery(event))
  if (!allowed.some(item => item.vehicleId === vehicleId))
    throw createError({ statusCode: 403, statusMessage: '无权查看该车辆位置' })
  return {
    code: 200,
    msg: '获取成功',
    data: await gpsLocationService.getVehicleLocation(vehicleId),
  }
})
