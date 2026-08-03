import type { ConfirmPaymentInput } from '../../../../../services/approval/finance-service'
import { getRouterParam, readBody } from 'h3'
import { approvalFinanceService } from '../../../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../../../utils/approval-route'
import { requireAnyRole } from '../../../../../utils/security'

export default defineApprovalHandler('confirm-payment', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const id = String(getRouterParam(event, 'id') || '')
  const body = await readBody<ConfirmPaymentInput>(event)
  return {
    code: 200,
    msg: '支付确认成功',
    data: await approvalFinanceService.confirmPayment(id, body),
  }
})
