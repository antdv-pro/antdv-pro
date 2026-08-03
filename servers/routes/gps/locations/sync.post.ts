import { defineEventHandler, readBody } from 'h3'
import { gpsLocationService } from '../../../services/gps/location-service'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event).catch(() => ({}))
    const data = await gpsLocationService.syncLatest(body?.provider)
    return {
      code: 200,
      msg: '同步成功',
      data,
    }
  }
  catch (error: any) {
    return { ...fail(event, asBadRequest(error), '定位同步失败'), data: { locations: [] } }
  }
})
