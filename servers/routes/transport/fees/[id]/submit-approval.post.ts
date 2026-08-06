import { defineEventHandler } from 'h3'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  return { code: 400, msg: '规费审批请在企业微信填写并发起，管理系统仅同步展示审批进度' }
})
