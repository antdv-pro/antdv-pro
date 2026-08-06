import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { createFinancialMonthOptions, createFinancialPeriodFilterModel, createFinancialYearOptions, createOccurredFinancialYearOptions, financialDateRangeValue, useFinancialPeriodFilter } from './financial-period-filter'

describe('financial period filter', () => {
  it('creates deterministic year and occurred-year options', () => {
    expect(createFinancialYearOptions(2026, 1)).toEqual([
      { label: '2027', value: 2027 },
      { label: '2026', value: 2026 },
      { label: '2025', value: 2025 },
    ])
    expect(createOccurredFinancialYearOptions(['202601', '2025-12', 'bad', '202601'])).toEqual([
      { label: '2026', value: 2026 },
      { label: '2025', value: 2025 },
    ])
  })

  it('filters and sorts month options or supplies a full year', () => {
    expect(createFinancialMonthOptions()).toEqual([])
    expect(createFinancialMonthOptions(2026, ['202603', '2026-01', '202512', '202603'])).toEqual([
      { label: '2026-3', value: 3 },
      { label: '2026-1', value: 1 },
    ])
    expect(createFinancialMonthOptions(2026)).toEqual(expect.arrayContaining([
      { label: '2026-12', value: 12 },
      { label: '2026-1', value: 1 },
    ]))
    expect(createFinancialMonthOptions(2026).map(item => item.value)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
  })

  it('supports initial overrides, computed params and reset', () => {
    const initial = createFinancialPeriodFilterModel({ financialYear: 2026, financialMonth: 2 })
    expect(initial).toMatchObject({ financialYear: 2026, financialMonth: 2, dateRange: null })
    const filter = useFinancialPeriodFilter(initial)
    expect(filter.queryParams.value).toMatchObject({ periodType: 'financialMonth', startDate: '2026-01-26' })
    filter.resetFinancialPeriodFilter({ financialYear: 2025 })
    expect(filter.model).toMatchObject({ financialYear: 2025, financialMonth: undefined, dateRange: null })
  })

  it('normalizes optional date ranges', () => {
    const range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-01-01'), dayjs('2026-01-02')]
    expect(financialDateRangeValue(range)).toBe(range)
    expect(financialDateRangeValue(undefined)).toBeNull()
  })
})
