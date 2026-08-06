import { getRouterParam, readBody } from 'h3'
import { approvalFinanceService } from '../../../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../../../utils/approval-route'
import { requireAnyRole } from '../../../../../utils/security'

export default defineApprovalHandler('fail-payment', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const id = String(getRouterParam(event, 'id') || '')
  const body = await readBody<{ reason: string }>(event)
  return {
    code: 200,
    msg: '已记录支付失败',
    data: await approvalFinanceService.failPayment(id, body.reason),
  }
})
