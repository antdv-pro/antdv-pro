import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { gpsLocationService } from '../../../../services/gps/location-service'
import { getTrustedAccessQuery } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const vehicleId = getRouterParam(event, 'vehicleId')!
    const allowed = await gpsLocationService.listVehicles(getTrustedAccessQuery(event))
    if (!allowed.some(item => item.vehicleId === vehicleId))
      throw createError({ statusCode: 403, statusMessage: '无权查看该车辆轨迹' })
    const query = getQuery(event)
    return {
      code: 200,
      msg: '获取成功',
      data: await gpsLocationService.getVehicleTrack(vehicleId, query.startTime as string, query.endTime as string, query.provider as any),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message ?? '获取轨迹失败',
    }
  }
})
