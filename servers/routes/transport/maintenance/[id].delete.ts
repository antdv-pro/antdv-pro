import { defineEventHandler, getRouterParam } from 'h3'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { transportMaintenanceStore } from '../../../utils/transport-maintenance-store'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    await transportMaintenanceStore.remove(getRouterParam(event, 'id'), user)
    return { code: 200, msg: '删除成功' }
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '维保记录删除失败')
  }
})
