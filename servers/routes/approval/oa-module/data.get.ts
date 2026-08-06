import { defineEventHandler } from 'h3'
import { approvalOaStateService } from '../../../services/approval/oa-state-service'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER', 'APPROVER'])
  return {
    code: 200,
    msg: '获取成功',
    // A module view must not create or update salary records as a side effect.
    data: await approvalOaStateService.get(),
  }
})
