import { defineEventHandler, readBody } from 'h3'
import { approvalWecomService } from '../../../services/approval/wecom-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  try {
    const body = await readBody(event)
    return { code: 200, msg: '同步成功', data: await approvalWecomService.syncApproval(String(body?.spNo || ''), body?.localInstanceId ? String(body.localInstanceId) : undefined) }
  }
  catch (error: any) {
    return { code: 400, msg: error?.message || '同步失败' }
  }
})
