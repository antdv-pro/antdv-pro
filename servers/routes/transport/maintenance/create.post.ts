import { defineEventHandler, readBody } from 'h3'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { transportMaintenanceStore } from '../../../utils/transport-maintenance-store'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    return { code: 200, msg: '新增成功', data: await transportMaintenanceStore.create(await readBody(event), user) }
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '维保记录新增失败')
  }
})
