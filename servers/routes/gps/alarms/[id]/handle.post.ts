import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { gpsAlarmService } from '../../../../services/gps/alarm-service'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const alarmId = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
    return {
      code: 200,
      msg: '处理成功',
      data: await gpsAlarmService.handle({
        alarmId,
        status: body.status ?? 'handled',
        handleRemark: body.handleRemark,
        operatorId: user.id,
        operatorName: user.nickname,
      }),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message ?? '处理失败',
    }
  }
})
