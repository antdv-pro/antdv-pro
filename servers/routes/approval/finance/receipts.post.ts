import type { RegisterReceiptInput } from '../../../services/approval/finance-service'
import { readBody } from 'h3'
import { approvalFinanceService } from '../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../utils/approval-route'
import { requireAnyRole } from '../../../utils/security'

export default defineApprovalHandler('register-receipt', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const body = await readBody<RegisterReceiptInput>(event)
  return {
    code: 200,
    msg: '来款登记成功',
    data: await approvalFinanceService.registerReceipt(body),
  }
})
