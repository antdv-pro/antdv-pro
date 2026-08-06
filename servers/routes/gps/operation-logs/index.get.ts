import { defineEventHandler } from 'h3'
import { gpsProviderService } from '../../../services/gps/provider-service'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  return {
    code: 200,
    msg: '获取成功',
    data: await gpsProviderService.listOperationLogs(),
  }
})
