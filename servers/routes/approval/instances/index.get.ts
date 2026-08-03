import { getQuery } from 'h3'
import { approvalInstanceService } from '../../../services/approval/instance-service'
import { defineApprovalHandler, logHandledApprovalError } from '../../../utils/approval-route'
import { requireAnyRole } from '../../../utils/security'

export default defineApprovalHandler('instances', async (event) => {
  try {
    requireAnyRole(event, ['ADMIN', 'APPROVER', 'FINANCE_MANAGER', 'DEPT_LEADER'])
    return {
      code: 200,
      msg: '获取成功',
      data: await approvalInstanceService.list(getQuery(event)),
    }
  }
  catch (error) {
    logHandledApprovalError(event, 'instances', error)
    return {
      code: 200,
      msg: '审批数据暂不可用',
      data: [],
    }
  }
})
