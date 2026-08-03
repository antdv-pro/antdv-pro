import { describe, expect, it } from 'vitest'
import { calculateActualCashTrend, calculateFinanceDashboardMetrics, latestCashBalance } from './finance-dashboard'

describe('finance dashboard accounting basis', () => {
  const records = [
    { id: 'ar-1', billType: '应收', amount: 1000, paidAmount: 400, unpaidAmount: 600, status: '部分收款', date: '2026-07-01' },
    { id: 'ap-1', billType: '应付', amount: 700, paidAmount: 200, unpaidAmount: 500, status: '部分付款', date: '2026-07-01' },
    { id: 'cash-in', accountName: '工行', accountType: '银行账户', incomeAmount: 400, expenseAmount: 0, currentBalance: 1400, status: '已核销', date: '2026-07-02' },
    { id: 'cash-out', accountName: '工行', accountType: '银行账户', incomeAmount: 0, expenseAmount: 200, currentBalance: 1200, status: '已支付', date: '2026-07-03' },
    { id: 'pending-pay', accountName: '工行', accountType: '银行账户', incomeAmount: 0, expenseAmount: 0, currentBalance: 1200, paymentAmount: 300, paymentStatus: 'PENDING', status: '待支付', date: '2026-07-04' },
    { id: 'processing-pay', accountName: '工行', accountType: '银行账户', incomeAmount: 0, expenseAmount: 0, currentBalance: 1200, paymentAmount: 50, paymentStatus: 'PROCESSING', status: '银行处理中', date: '2026-07-05' },
  ]

  it('separates planned receivables and payables from actual cash movements', () => {
    expect(calculateFinanceDashboardMetrics(records)).toMatchObject({
      actualIncome: 400,
      actualExpense: 200,
      netCashFlow: 200,
      receivableTotal: 1000,
      payableTotal: 700,
      outstandingReceivable: 600,
      outstandingPayable: 500,
      pendingPaymentAmount: 350,
    })
  })

  it('uses a supplied balance snapshot even when it is zero', () => {
    expect(calculateFinanceDashboardMetrics(records, 0).cashBalance).toBe(0)
    expect(calculateFinanceDashboardMetrics(records, 999).cashBalance).toBe(999)
  })

  it('uses only the latest balance per account instead of summing every flow balance', () => {
    expect(latestCashBalance(records)).toBe(1200)
  })

  it('counts a duplicated approval once and uses one amount field per record', () => {
    const approvalRows = [
      { approvalInstanceId: 'approval-1', status: '审批中', amount: 500, totalAmount: 500 },
      { approvalInstanceId: 'approval-1', status: '待审批', amount: 500 },
    ]
    expect(calculateFinanceDashboardMetrics(approvalRows)).toMatchObject({ pendingApprovalAmount: 500, pendingApprovalCount: 1 })
  })

  it('builds trends from cash flows only and ignores receivable plans', () => {
    expect(calculateActualCashTrend(records)).toEqual([
      { month: '2026-07', income: 400, expense: 200, net: 200 },
    ])
  })
})
