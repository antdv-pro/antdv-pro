import { defineEventHandler } from 'h3'
import { approvalWecomService } from '../../../services/approval/wecom-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  try {
    await approvalWecomService.testConnection()
    return { code: 200, msg: '连接成功', data: true }
  }
  catch (error: any) {
    return { code: 400, msg: error?.message || '连接失败', data: false }
  }
})
