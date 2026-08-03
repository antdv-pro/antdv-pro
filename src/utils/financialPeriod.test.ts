import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import {
  formatFinancialMonthLabel,
  formatFinancialQueryDateTime,
  formatFinancialYearLabel,
  getFinancialMonthByDate,
  getFinancialMonthRange,
  getFinancialYearByDate,
  getFinancialYearRange,
  parseFinancialMonthKey,
  resolveFinancialPeriodQuery,
} from './financialPeriod'

describe('financialPeriod', () => {
  it('calculates requested financial month ranges with right-open end dates', () => {
    expect(getFinancialMonthRange(2026, 1)).toMatchObject({
      key: '202601',
      startDate: '2025-12-26',
      endDate: '2026-01-26',
      displayStartDate: '2025-12-26',
      displayEndDate: '2026-01-25',
    })

    expect(getFinancialMonthRange(2026, 2)).toMatchObject({
      key: '202602',
      startDate: '2026-01-26',
      endDate: '2026-02-26',
      displayStartDate: '2026-01-26',
      displayEndDate: '2026-02-25',
    })

    expect(getFinancialMonthRange(2026, 7)).toMatchObject({
      key: '202607',
      startDate: '2026-06-26',
      endDate: '2026-07-26',
      displayStartDate: '2026-06-26',
      displayEndDate: '2026-07-25',
    })
  })

  it('calculates requested financial year ranges with right-open end dates', () => {
    expect(getFinancialYearRange(2026)).toMatchObject({
      key: '2026',
      startDate: '2025-12-26',
      endDate: '2026-12-26',
      displayStartDate: '2025-12-26',
      displayEndDate: '2026-12-25',
    })
  })

  it.each([
    ['2025-12-25', '202512', '2025'],
    ['2025-12-26', '202601', '2026'],
    ['2026-01-25', '202601', '2026'],
    ['2026-01-26', '202602', '2026'],
    ['2026-06-25', '202606', '2026'],
    ['2026-06-26', '202607', '2026'],
    ['2026-07-25', '202607', '2026'],
    ['2026-07-26', '202608', '2026'],
    ['2026-12-25', '202612', '2026'],
    ['2026-12-26', '202701', '2027'],
  ])('maps %s to the correct financial month and year', (date, monthKey, yearKey) => {
    expect(getFinancialMonthByDate(date).key).toBe(monthKey)
    expect(getFinancialYearByDate(date).key).toBe(yearKey)
  })

  it('formats labels compactly', () => {
    expect(formatFinancialMonthLabel(2026, 1)).toBe('2026-1')
    expect(formatFinancialYearLabel(2026)).toBe('2026')
  })

  it('resolves filter params with custom date range priority', () => {
    expect(resolveFinancialPeriodQuery({
      financialYear: 2026,
      financialMonth: 1,
      dateRange: [dayjs('2026-03-02'), dayjs('2026-03-08')],
    })).toMatchObject({
      startDate: '2026-03-02',
      endDate: '2026-03-09',
      periodType: 'customRange',
    })
  })

  it('resolves year and month filters to financial right-open ranges', () => {
    expect(resolveFinancialPeriodQuery({ financialYear: 2026, financialMonth: 1 })).toMatchObject({
      startDate: '2025-12-26',
      endDate: '2026-01-26',
      periodType: 'financialMonth',
    })

    expect(resolveFinancialPeriodQuery({ financialYear: 2026 })).toMatchObject({
      startDate: '2025-12-26',
      endDate: '2026-12-26',
      periodType: 'financialYear',
    })
  })

  it('parses normalized month keys and rejects invalid values', () => {
    expect(parseFinancialMonthKey('2026-02')?.key).toBe('202602')
    expect(parseFinancialMonthKey('202613')).toBeUndefined()
    expect(parseFinancialMonthKey('2026')).toBeUndefined()
  })

  it('formats query boundaries as date times', () => {
    expect(formatFinancialQueryDateTime(getFinancialMonthRange(2026, 2))).toEqual({
      startDate: '2026-01-26 00:00:00',
      endDate: '2026-02-26 00:00:00',
    })
  })
})
