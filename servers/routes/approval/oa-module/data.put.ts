import { defineEventHandler, readBody } from 'h3'
import { approvalOaStateService } from '../../../services/approval/oa-state-service'
import { asBadRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER'])
  try {
    const body = await readBody(event)
    const data = body?.partition
      ? await approvalOaStateService.replacePartition(body.partition, body.rows, Number(body.revision))
      : await approvalOaStateService.replace(body)
    return ok(data, '保存成功')
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), 'OA 数据保存失败')
  }
})
