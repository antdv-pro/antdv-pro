import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { gpsProviderService } from '../../../../services/gps/provider-service'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const vehicleId = getRouterParam(event, 'vehicleId')!
    const body = await readBody(event)
    const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
    return {
      code: 200,
      msg: '绑定成功',
      data: await gpsProviderService.bindVehicleDevice({
        vehicleId,
        deviceId: body.deviceId,
        provider: body.provider,
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
