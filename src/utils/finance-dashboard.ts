export interface FinanceRecord extends Record<string, any> {
  id?: string
  code?: string
  date?: string
  status?: string
  billType?: string
  amount?: number
  paidAmount?: number
  unpaidAmount?: number
  incomeAmount?: number
  expenseAmount?: number
  currentBalance?: number
  accountName?: string
  accountType?: string
  financialYear?: number
  financialMonth?: number
}

export interface FinanceDashboardMetrics {
  actualIncome: number
  actualExpense: number
  netCashFlow: number
  receivableTotal: number
  payableTotal: number
  receivedAmount: number
  paidAmount: number
  outstandingReceivable: number
  outstandingPayable: number
  cashBalance: number
  pendingApprovalAmount: number
  pendingApprovalCount: number
  pendingPaymentAmount: number
  unrecognizedReceiptAmount: number
}

function number(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function isVoided(record: FinanceRecord) {
  return /作废|已撤回|已驳回|审批驳回/.test(String(record.status || ''))
}

function sum(records: FinanceRecord[], field: string) {
  return round(records.reduce((total, record) => total + number(record[field]), 0))
}

function recordTime(record: FinanceRecord) {
  const value = record.paidAt || record.receiptDate || record.date || ''
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function latestCashBalance(records: FinanceRecord[]) {
  const latestByAccount = new Map<string, FinanceRecord>()
  records.filter(record => record.accountName && !isVoided(record) && !['PENDING', 'PROCESSING', 'FAILED'].includes(String(record.paymentStatus || ''))).forEach((record) => {
    const key = `${record.accountType || ''}:${record.accountName}`
    const current = latestByAccount.get(key)
    if (!current || recordTime(record) >= recordTime(current))
      latestByAccount.set(key, record)
  })
  return round(Array.from(latestByAccount.values()).reduce((total, record) => total + number(record.currentBalance), 0))
}

export function pendingApprovalSummary(records: FinanceRecord[]) {
  const approvals = new Map<string, number>()
  records.filter(record => /待审批|审批中/.test(String(record.status || ''))).forEach((record, index) => {
    const businessKey = record.businessType || record.businessId ? `${record.businessType || ''}:${record.businessId || ''}` : ''
    const key = String(record.approvalInstanceId || record.approvalNo || businessKey || record.code || index)
    const amount = number(record.amount || record.totalAmount || record.totalFee || record.netSalary)
    approvals.set(key, Math.max(approvals.get(key) || 0, amount))
  })
  return {
    amount: round(Array.from(approvals.values()).reduce((total, amount) => total + amount, 0)),
    count: approvals.size,
  }
}

export function calculateFinanceDashboardMetrics(records: FinanceRecord[], balanceSnapshot?: number): FinanceDashboardMetrics {
  const active = records.filter(record => !isVoided(record))
  const cashFlows = active.filter(record => record.accountName && (record.incomeAmount != null || record.expenseAmount != null))
  const receivables = active.filter(record => record.billType === '应收')
  const payables = active.filter(record => record.billType === '应付')
  const approvals = pendingApprovalSummary(active)
  const actualIncome = sum(cashFlows, 'incomeAmount')
  const actualExpense = sum(cashFlows, 'expenseAmount')

  return {
    actualIncome,
    actualExpense,
    netCashFlow: round(actualIncome - actualExpense),
    receivableTotal: sum(receivables, 'amount'),
    payableTotal: sum(payables, 'amount'),
    receivedAmount: sum(receivables, 'paidAmount'),
    paidAmount: sum(payables, 'paidAmount'),
    outstandingReceivable: sum(receivables, 'unpaidAmount'),
    outstandingPayable: sum(payables, 'unpaidAmount'),
    cashBalance: balanceSnapshot === undefined ? latestCashBalance(cashFlows) : round(balanceSnapshot),
    pendingApprovalAmount: approvals.amount,
    pendingApprovalCount: approvals.count,
    pendingPaymentAmount: sum(active.filter(record => ['PENDING', 'PROCESSING'].includes(record.paymentStatus)), 'paymentAmount'),
    unrecognizedReceiptAmount: sum(active.filter(record => record.flowType === '来款登记'), 'unrecognizedAmount'),
  }
}

export function calculateActualCashTrend(records: FinanceRecord[]) {
  const monthly = new Map<string, { month: string, income: number, expense: number }>()
  records.filter(record => !isVoided(record) && record.accountName).forEach((record) => {
    const date = new Date(record.date || '')
    const year = number(record.financialYear) || (!Number.isNaN(date.getTime()) ? date.getFullYear() : 0)
    const month = number(record.financialMonth) || (!Number.isNaN(date.getTime()) ? date.getMonth() + 1 : 0)
    if (!year || month < 1 || month > 12)
      return
    const key = `${year}-${String(month).padStart(2, '0')}`
    const item = monthly.get(key) || { month: key, income: 0, expense: 0 }
    item.income = round(item.income + number(record.incomeAmount))
    item.expense = round(item.expense + number(record.expenseAmount))
    monthly.set(key, item)
  })
  return Array.from(monthly.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(item => ({ ...item, net: round(item.income - item.expense) }))
}
