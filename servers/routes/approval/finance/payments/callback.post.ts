import type { BankPaymentCallbackInput } from '../../../../services/approval/finance-service'
import { getRequestHeader, readRawBody } from 'h3'
import { approvalFinanceService } from '../../../../services/approval/finance-service'
import { defineApprovalHandler } from '../../../../utils/approval-route'

export default defineApprovalHandler('bank-payment-callback', async (event) => {
  const rawBody = await readRawBody(event) || ''
  const signature = String(getRequestHeader(event, 'x-payment-signature') || '')
  if (!approvalFinanceService.verifyCallback(rawBody, signature)) {
    event.res.status = 403
    return { code: 403, msg: '回调签名无效' }
  }
  const body = JSON.parse(rawBody) as BankPaymentCallbackInput
  if (!['SUCCESS', 'FAILED'].includes(body.status))
    throw new Error('不支持的支付回调状态')
  return {
    code: 200,
    msg: '支付回调处理成功',
    data: await approvalFinanceService.handleCallback(body),
  }
})
