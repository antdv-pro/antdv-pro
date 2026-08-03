import { defineEventHandler, readBody } from 'h3'
import { approvalWecomService } from '../../../services/approval/wecom-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  try {
    const body = await readBody(event)
    const data = body?.incremental
      ? await approvalWecomService.syncIncremental()
      : await approvalWecomService.syncRange({
          days: body?.days,
          startTime: body?.startTime,
          endTime: body?.endTime,
        })
    return { code: 200, msg: '批量同步完成', data }
  }
  catch (error: any) {
    return { code: 400, msg: error?.message || '批量同步失败' }
  }
})
