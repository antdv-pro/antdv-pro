import { approvalFinanceService } from '../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../utils/approval-route'
import { requireAnyRole } from '../../../utils/security'

export default defineApprovalHandler('reconcile-finance-records', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const data = await approvalFinanceService.reconcile()
  return { code: 200, msg: data.repairedCount ? `已回补 ${data.repairedCount} 条财务记录` : '没有需要回补的财务记录', data }
})
