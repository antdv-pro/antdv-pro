import { describe, expect, it } from 'vitest'
import { createFinancialComparison, formatFinancialComparisonChange } from './financial-comparison'

describe('financial comparison', () => {
  it('reports upward and downward changes against the previous month', () => {
    expect(createFinancialComparison(112.4, 100, '100 单')).toEqual({
      previousValue: '100 单',
      direction: 'up',
      percent: 12.400000000000006,
    })
    expect(formatFinancialComparisonChange(createFinancialComparison(87.6, 100))).toBe('下降 12.4%')
  })

  it('handles zero baselines without reporting an infinite percentage', () => {
    expect(createFinancialComparison(8, 0)).toEqual({ previousValue: 0, direction: 'new' })
    expect(createFinancialComparison(0, 0)).toEqual({ previousValue: 0, direction: 'flat', percent: 0 })
  })

  it('treats tiny differences as flat and supports negative values', () => {
    expect(formatFinancialComparisonChange(createFinancialComparison(100.04, 100))).toBe('持平 0%')
    expect(formatFinancialComparisonChange(createFinancialComparison(-50, -100))).toBe('上升 50%')
  })
})
