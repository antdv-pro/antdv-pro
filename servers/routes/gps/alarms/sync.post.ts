import { defineEventHandler, readBody } from 'h3'
import { gpsAlarmService } from '../../../services/gps/alarm-service'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event).catch(() => ({}))
    const data = await gpsAlarmService.sync(body?.provider)
    return {
      code: 200,
      msg: '同步成功',
      data,
    }
  }
  catch (error: any) {
    return { ...fail(event, asBadRequest(error), '报警同步失败'), data: { alarms: [] } }
  }
})
