import { describe, expect, it } from 'vitest'
import { resolveApprovalFinancialPeriod } from './approval-financial-period'

describe('resolveApprovalFinancialPeriod', () => {
  it('derives the period from common date formats', () => {
    expect(resolveApprovalFinancialPeriod(['2026-07-21'])).toEqual({ financialYear: 2026, financialMonth: 7 })
    expect(resolveApprovalFinancialPeriod(['2026年12月26日'])).toEqual({ financialYear: 2026, financialMonth: 12 })
  })

  it('uses the first valid date before explicit selections', () => {
    expect(resolveApprovalFinancialPeriod(['', '2027/03/05'], '2026年', '7月')).toEqual({ financialYear: 2027, financialMonth: 3 })
    expect(resolveApprovalFinancialPeriod(['业务日期 2026-07-15', '付款日期 2026-08-01'])).toEqual({ financialYear: 2026, financialMonth: 7 })
  })

  it('falls back to explicit year and month when no date exists', () => {
    expect(resolveApprovalFinancialPeriod([], '2026年', '7月')).toEqual({ financialYear: 2026, financialMonth: 7 })
  })
})
