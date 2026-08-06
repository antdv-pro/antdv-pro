import type { CreatePaymentInstructionInput } from '../../../services/approval/finance-service'
import { readBody } from 'h3'
import { approvalFinanceService } from '../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../utils/approval-route'
import { requireAnyRole } from '../../../utils/security'

export default defineApprovalHandler('create-payment', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const body = await readBody<CreatePaymentInstructionInput>(event)
  return {
    code: 200,
    msg: '付款指令创建成功',
    data: await approvalFinanceService.createPayment(body),
  }
})
