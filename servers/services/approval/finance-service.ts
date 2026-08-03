import type {
  AllocateReceiptInput,
  BankPaymentCallbackInput,
  ConfirmPaymentInput,
  CreatePaymentInstructionInput,
  RegisterReceiptInput,
} from '../../utils/oa-module-store'
import { inspectFinanceReconciliation, reconcileApprovedFinanceRecords } from '../../utils/finance-reconciliation'
import { oaModuleStore } from '../../utils/oa-module-store'
import { getPaymentProvider, verifyPaymentCallbackSignature } from '../../utils/payment-provider'

export type { AllocateReceiptInput, BankPaymentCallbackInput, ConfirmPaymentInput, CreatePaymentInstructionInput, ReceiptAllocationInput, RegisterReceiptInput } from '../../utils/oa-module-store'

export const approvalFinanceService = {
  registerReceipt: (input: RegisterReceiptInput) => oaModuleStore.registerReceipt(input),
  allocateReceipt: (id: string, input: AllocateReceiptInput) => oaModuleStore.allocateReceipt(id, input),
  createPayment: (input: CreatePaymentInstructionInput) => oaModuleStore.createPaymentInstruction(input),
  confirmPayment: (id: string, input: ConfirmPaymentInput) => oaModuleStore.confirmPayment(id, input),
  failPayment: (id: string, reason: string) => oaModuleStore.failPayment(id, reason),
  handleCallback: (input: BankPaymentCallbackInput) => oaModuleStore.handleBankPaymentCallback(input),
  verifyCallback: (rawBody: string, signature: string) => verifyPaymentCallbackSignature(rawBody, signature),
  inspectReconciliation: () => inspectFinanceReconciliation(),
  reconcile: () => reconcileApprovedFinanceRecords(),
  async submitPayment(id: string) {
    const state = await oaModuleStore.getState()
    const payment = state.modules.cash.find(item => String(item.id) === String(id) && item.flowType === '付款执行')
    if (!payment)
      throw new Error('付款指令不存在')
    if (payment.paymentStatus === 'PROCESSING')
      return payment
    const submission = await getPaymentProvider().submit({
      paymentId: String(payment.id),
      paymentRequestNo: String(payment.paymentRequestNo),
      accountName: String(payment.accountName || ''),
      payeeName: String(payment.payeeName),
      amount: Number(payment.paymentAmount),
      paymentDate: String(payment.date),
      remark: String(payment.remark || ''),
    })
    return oaModuleStore.markPaymentSubmitted(id, submission)
  },
}
