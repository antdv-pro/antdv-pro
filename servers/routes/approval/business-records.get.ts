import { getQuery } from 'h3'
import { approvalInstanceService } from '../../services/approval/instance-service'
import { defineApprovalHandler } from '../../utils/approval-route'
import { requireAnyRole } from '../../utils/security'

export default defineApprovalHandler('business-records', async (event) => {
  requireAnyRole(event, ['ADMIN', 'APPROVER', 'FINANCE_MANAGER', 'DEPT_LEADER'])
  const query = getQuery(event)
  return {
    code: 200,
    msg: '获取成功',
    data: await approvalInstanceService.listBusinessRecords(query),
  }
})
