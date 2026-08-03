import { beforeEach, describe, expect, it, vi } from 'vitest'

import { calculateFinanceDashboardMetrics } from '../../src/utils/finance-dashboard'
import { approvalStore } from './approval-store'
import { oaModuleStore } from './oa-module-store'

const users = [
  { id: 1, nickname: '管理员' },
  { id: 2, nickname: '申请人' },
  { id: 3, nickname: '财务经理' },
  { id: 4, nickname: '部门负责人' },
  { id: 5, nickname: '总经理' },
]

vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))
vi.mock('./system-store', () => ({ systemStore: { listUsers: vi.fn(async () => users) } }))

async function approveFully(detail: any) {
  let current = detail
  while (current.instance.status !== 'APPROVED') {
    const task = current.tasks.find((item: any) => item.status === 'PENDING')
    current = await approvalStore.approve({
      taskId: task.id,
      operatorId: task.assigneeId,
      operatorName: task.assigneeName,
    })
  }
  return current
}

function allFinanceRows(state: Awaited<ReturnType<typeof oaModuleStore.getState>>) {
  return Object.values(state.modules).flat()
}

describe('approval and finance end-to-end workflows', () => {
  beforeEach(async () => {
    await approvalStore.resetForTest()
    await oaModuleStore.replaceState({})
  })

  it('moves an approved expense through payable, payment, cash flow and dashboard', async () => {
    const submitted = await approvalStore.submit({
      businessType: 'expense',
      businessId: 'expense-e2e-1',
      businessNo: 'EXP-E2E-1',
      title: '车辆费用报销',
      applicantId: 2,
      applicantName: '申请人',
      amount: 600,
      formData: { supplierName: '供应商甲', occurredDate: '2026-07-17', dueDate: '2026-07-20' },
    })
    await approveFully(submitted)

    let state = await oaModuleStore.getState()
    const payable = state.modules.receivable.find(row => row.sourceApprovalId === submitted.instance.id)!
    expect(payable).toMatchObject({ billType: '应付', amount: 600, unpaidAmount: 600, status: '未付' })

    state.modules.cash.push({ id: 'opening-balance', code: 'OPEN-1', accountName: '工行基本户', accountType: '银行账户', currentBalance: 2000, date: '2026-07-16', flowType: '余额初始化', status: '正常' })
    await oaModuleStore.replaceState(state)
    const payment = await oaModuleStore.createPaymentInstruction({
      paymentRequestNo: 'PAY-E2E-1',
      accountName: '工行基本户',
      paymentDate: '2026-07-17',
      payeeName: '供应商甲',
      allocations: [{ payableId: payable.id, amount: 600 }],
    })
    await oaModuleStore.confirmPayment(payment.id, { bankSerialNo: 'BANK-PAY-E2E-1' })

    state = await oaModuleStore.getState()
    expect(state.modules.receivable.find(row => row.id === payable.id)).toMatchObject({ paidAmount: 600, unpaidAmount: 0, status: '已结清' })
    expect(state.modules.cash.find(row => row.id === payment.id)).toMatchObject({ expenseAmount: 600, currentBalance: 1400, status: '已支付' })
    expect(calculateFinanceDashboardMetrics(allFinanceRows(state))).toMatchObject({ actualExpense: 600, outstandingPayable: 0, cashBalance: 1400 })
  })

  it('moves an approved receivable through receipt allocation and dashboard', async () => {
    const submitted = await approvalStore.submit({
      businessType: 'receivable',
      businessId: 'income-e2e-1',
      businessNo: 'YS-E2E-1',
      title: '运输收入应收确认',
      applicantId: 2,
      applicantName: '申请人',
      amount: 1000,
      formData: { customerName: '客户甲', occurredDate: '2026-07-17', dueDate: '2026-08-17' },
    })
    await approveFully(submitted)

    let state = await oaModuleStore.getState()
    const receivable = state.modules.receivable.find(row => row.sourceApprovalId === submitted.instance.id)!
    expect(receivable).toMatchObject({ billType: '应收', amount: 1000, unpaidAmount: 1000, status: '未收' })

    state.cashBalanceRecords.push({
      id: 'receipt-account',
      balance_date: '2026-07-16',
      company_name: '测试主体',
      bank_name: '建设银行',
      account_name: '建行一般户',
      account_no_tail: '1266',
      balance_amount: 2000,
    })
    await oaModuleStore.replaceState(state)
    const receipt = await oaModuleStore.registerReceipt({
      accountName: '建行一般户',
      amount: 1000,
      receiptDate: '2026-07-17',
      payerName: '客户甲',
      bankSerialNo: 'BANK-RC-E2E-1',
    })
    await oaModuleStore.allocateReceipt(receipt.id, {
      cashBalanceId: 'receipt-account',
      allocationBatchId: 'RA-E2E-1',
      handler: '财务经理',
      allocations: [{ receivableId: receivable.id, amount: 1000 }],
    })

    state = await oaModuleStore.getState()
    expect(state.modules.receivable.find(row => row.id === receivable.id)).toMatchObject({ paidAmount: 1000, unpaidAmount: 0, status: '已结清' })
    expect(state.modules.cash.find(row => row.id === receipt.id)).toMatchObject({ incomeAmount: 1000, recognizedAmount: 1000, status: '已核销' })
    expect(state.cashBalanceRecords.find(row => row.id === 'receipt-account')).toMatchObject({ balance_amount: 3000 })
    expect(calculateFinanceDashboardMetrics(allFinanceRows(state))).toMatchObject({ actualIncome: 1000, outstandingReceivable: 0 })
  })
})
