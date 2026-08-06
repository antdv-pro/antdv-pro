import { defineEventHandler, readBody } from 'h3'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { transportMaintenanceStore } from '../../../utils/transport-maintenance-store'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    return { code: 200, msg: '库存操作成功', data: await transportMaintenanceStore.createInventoryOperation(await readBody(event), user) }
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '库存操作失败')
  }
})
