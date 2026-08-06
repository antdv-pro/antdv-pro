import { defineEventHandler } from 'h3'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'APPROVER', 'FINANCE_MANAGER', 'DEPT_LEADER'])
  return { code: 400, msg: '审批单请在企业微信填写并发起，管理系统不再发起审批' }
})
