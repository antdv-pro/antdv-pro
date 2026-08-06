import { defineEventHandler, readBody } from 'h3'
import { gpsProviderService } from '../../../services/gps/provider-service'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event).catch(() => ({}))
    const data = await gpsProviderService.syncDevices(body?.provider)
    return {
      code: 200,
      msg: '同步成功',
      data,
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message || '设备同步失败',
      data: { devices: [] },
    }
  }
})
