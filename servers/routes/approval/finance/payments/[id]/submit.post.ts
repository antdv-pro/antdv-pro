import { getRouterParam } from 'h3'
import { approvalFinanceService } from '../../../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../../../utils/approval-route'
import { requireAnyRole } from '../../../../../utils/security'

export default defineApprovalHandler('submit-bank-payment', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const id = String(getRouterParam(event, 'id') || '')
  return {
    code: 200,
    msg: '付款指令已提交银行',
    data: await approvalFinanceService.submitPayment(id),
  }
})
