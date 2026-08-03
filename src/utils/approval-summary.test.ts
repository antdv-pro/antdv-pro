import { describe, expect, it } from 'vitest'
import {
  calculatePendingApprovalAmount,
  getApprovalAmount,
  summarizePendingApprovalAmountsByDepartment,
} from './approval-summary'

describe('approval summary', () => {
  it('uses the first valid amount across current and historical storage fields', () => {
    expect(getApprovalAmount({ amount: 120 })).toBe(120)
    expect(getApprovalAmount({ formSnapshot: { amount: '88.50' } })).toBe(88.5)
    expect(getApprovalAmount({ amount: 'invalid', payload: { amount: 60 } })).toBe(60)
    expect(getApprovalAmount({ formData: { amount: 25 } })).toBe(25)
  })

  it('only totals pending and approving records', () => {
    const records = [
      { status: 'PENDING', amount: 100 },
      { status: 'APPROVING', amount: 80 },
      { status: 'APPROVED', amount: 200 },
      { status: 'REJECTED', amount: 300 },
    ]

    expect(calculatePendingApprovalAmount(records)).toBe(180)
  })

  it('groups pending amounts by business department and keeps unassigned records visible', () => {
    const records = [
      { status: 'PENDING', deptName: '运输部', amount: 100 },
      { status: 'APPROVING', deptName: '运输部', formSnapshot: { amount: 50 } },
      { status: 'PENDING', formSnapshot: { departmentName: '酒店部', amount: 90 } },
      { status: 'PENDING', deptName: '  ', payload: { amount: 20 } },
      { status: 'APPROVED', deptName: '运输部', amount: 999 },
    ]

    expect(summarizePendingApprovalAmountsByDepartment(records)).toEqual([
      { departmentName: '运输部', amount: 150, count: 2 },
      { departmentName: '酒店部', amount: 90, count: 1 },
      { departmentName: '未分配部门', amount: 20, count: 1 },
    ])
  })
})
