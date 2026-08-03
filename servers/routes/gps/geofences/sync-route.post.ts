import { defineEventHandler, readBody } from 'h3'
import { gpsGeofenceService } from '../../../services/gps/geofence-service'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
    return {
      code: 200,
      msg: '路线电子围栏已同步',
      data: await gpsGeofenceService.syncRoutes({ ...body, operatorId: user.id, operatorName: user.nickname }),
    }
  }
  catch (error: any) {
    return { code: 400, msg: error?.message ?? '路线电子围栏同步失败' }
  }
})
