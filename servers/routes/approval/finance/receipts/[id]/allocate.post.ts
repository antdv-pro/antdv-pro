import type { AllocateReceiptInput } from '../../../../../services/approval/finance-service'
import { getRouterParam, readBody } from 'h3'
import { approvalFinanceService } from '../../../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../../../utils/approval-route'
import { requireAnyRole } from '../../../../../utils/security'

export default defineApprovalHandler('allocate-receipt', async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const id = String(getRouterParam(event, 'id') || '')
  const body = await readBody<AllocateReceiptInput>(event)
  return {
    code: 200,
    msg: '来款核销成功',
    data: await approvalFinanceService.allocateReceipt(id, body),
  }
})
