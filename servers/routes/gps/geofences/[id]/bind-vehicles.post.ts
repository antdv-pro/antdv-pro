import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { gpsGeofenceService } from '../../../../services/gps/geofence-service'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const geofenceId = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
    return {
      code: 200,
      msg: '绑定成功',
      data: await gpsGeofenceService.bindVehicles({
        geofenceId,
        vehicleIds: body.vehicleIds ?? [],
        operatorId: user.id,
        operatorName: user.nickname,
      }),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message ?? '绑定失败',
    }
  }
})
