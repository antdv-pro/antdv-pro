import { defineEventHandler, readBody } from 'h3'
import { approvalWecomService } from '../../../services/approval/wecom-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  try {
    return { code: 200, msg: '保存成功', data: approvalWecomService.saveConfig(await readBody(event)) }
  }
  catch (error: any) {
    return { code: 400, msg: error?.message || '保存失败' }
  }
})
