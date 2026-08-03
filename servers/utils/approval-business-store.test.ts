import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listApprovalBusinessState } from './approval-business-store'
import { dispatchApprovalBusinessCallback } from './approval-callback-dispatcher'

vi.mock('./mysql', () => ({ getMysqlPool: () => undefined, isDatabaseRequired: () => false }))

function approval(overrides: Record<string, any> = {}) {
  return {
    id: 'approval-1',
    businessType: 'expense',
    businessId: 'business-1',
    businessNo: 'NO-1',
    title: '测试审批',
    applicantId: 7,
    payload: {},
    amount: 0,
    ...overrides,
  } as any
}

describe('approval business effects', () => {
  beforeEach(() => {
    const state = listApprovalBusinessState()
    state.seq = 1000
    state.records = []
    state.cashAccounts = [{ id: 'cash-default', name: '默认现金账户', balance: 30000 }]
    state.cashFlows = []
    state.leaveBalances = []
  })

  it('tracks pending, rejected and revoked business states', async () => {
    const item = approval()
    await dispatchApprovalBusinessCallback('pending', item)
    expect(listApprovalBusinessState().records[0].status).toBe('审批中')
    await dispatchApprovalBusinessCallback('rejected', item)
    expect(listApprovalBusinessState().records[0].status).toBe('已驳回')
    await dispatchApprovalBusinessCallback('revoked', item)
    expect(listApprovalBusinessState().records[0].status).toBe('已撤回')
    expect(listApprovalBusinessState().records).toHaveLength(1)
  })

  it('applies a cash expense exactly once', async () => {
    const item = approval({ businessType: 'cash_expense', amount: 1250.5, payload: { accountId: 'cash-default' } })
    await dispatchApprovalBusinessCallback('approved', item)
    await dispatchApprovalBusinessCallback('approved', item)
    const state = listApprovalBusinessState()
    expect(state.cashAccounts[0].balance).toBe(28749.5)
    expect(state.cashFlows).toHaveLength(1)
    expect(state.cashFlows[0]).toMatchObject({ approvalInstanceId: 'approval-1', flowType: '支出', amount: 1250.5 })
    expect(state.records[0]).toMatchObject({ status: '已通过', applied: true })
  })

  it.each([
    [{ amount: -1 }, '现金支出金额不能为负数'],
    [{ amount: 40000 }, '现金账户余额不足'],
    [{ amount: 1, payload: { accountId: 'missing' } }, '现金账户不存在'],
  ])('rolls back invalid cash approval %#', async (overrides, message) => {
    const item = approval({ businessType: 'cash_expense', ...overrides })
    await expect(dispatchApprovalBusinessCallback('approved', item)).rejects.toThrow(message)
    const state = listApprovalBusinessState()
    expect(state.cashAccounts).toEqual([{ id: 'cash-default', name: '默认现金账户', balance: 30000 }])
    expect(state.cashFlows).toEqual([])
    expect(state.records).toEqual([])
  })

  it('calculates inclusive leave days and remains idempotent', async () => {
    const item = approval({ businessType: 'leave', applicantId: 7, payload: { startDate: '2026-07-01', endDate: '2026-07-03' } })
    await dispatchApprovalBusinessCallback('approved', item)
    await dispatchApprovalBusinessCallback('approved', item)
    const state = listApprovalBusinessState()
    expect(state.leaveBalances).toEqual([{ employeeId: 7, annualLeaveDays: 10, usedLeaveDays: 3 }])
    expect(state.records[0].payload).toMatchObject({ leaveStartDate: '2026-07-01', leaveEndDate: '2026-07-03' })
  })

  it('falls back to submitted leave days for invalid date values', async () => {
    const item = approval({ businessType: 'leave', payload: { employeeId: 'E1', startDate: 'bad', endDate: 'bad', leaveDays: 2.5 } })
    await dispatchApprovalBusinessCallback('approved', item)
    expect(listApprovalBusinessState().leaveBalances[0]).toMatchObject({ employeeId: 'E1', usedLeaveDays: 2.5 })
  })

  it.each(['expense', 'payment', 'purchase', 'reimbursement'])('marks %s approvals as generated pending payments', async (businessType) => {
    const item = approval({ id: `approval-${businessType}`, businessType, payload: {} })
    await dispatchApprovalBusinessCallback('approved', item)
    const record = listApprovalBusinessState().records.find(value => value.approvalInstanceId === item.id)
    expect(record?.payload).toMatchObject({ paymentStatus: '待付款', expenseGenerated: true })
  })
})
