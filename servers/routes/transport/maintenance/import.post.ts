import { defineEventHandler, readBody } from 'h3'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { transportMaintenanceStore } from '../../../utils/transport-maintenance-store'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event)
    const records = await transportMaintenanceStore.importRecords(body?.records, user)
    return { code: 200, msg: '导入成功', data: { records, importedCount: records.length } }
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '维保记录导入失败')
  }
})
