import { approvalFinanceService } from '../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../utils/approval-route'
import { requireAnyRole } from '../../../utils/security'

export default defineApprovalHandler('finance-reconciliation', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  return { code: 200, msg: '财务回写检查完成', data: await approvalFinanceService.inspectReconciliation() }
})
