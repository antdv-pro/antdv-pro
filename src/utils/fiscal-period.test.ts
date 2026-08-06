import { describe, expect, it } from 'vitest'
import { fiscalMonthDisplayRange, fiscalMonthKey, fiscalPeriodRangeValue, formatFiscalQueryRange, getFiscalMonthPeriod, parseFiscalMonthKey } from './fiscal-period'

describe('fiscal period compatibility API', () => {
  it('delegates month calculations to the financial-period implementation', () => {
    const period = getFiscalMonthPeriod(2026, 1)
    expect(period.key).toBe('202601')
    expect(fiscalMonthKey('2025-12-26')).toBe('202601')
    expect(fiscalMonthDisplayRange('2025-12-26')).toBe('2025-12-26 至 2026-01-25')
    expect(parseFiscalMonthKey('2026/01')?.key).toBe('202601')
  })

  it('returns UI ranges and API date-time boundaries', () => {
    const period = getFiscalMonthPeriod(2026, 2)
    const [start, end] = fiscalPeriodRangeValue(period)
    expect([start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]).toEqual(['2026-01-26', '2026-02-25'])
    expect(formatFiscalQueryRange(period)).toEqual({ startDate: '2026-01-26 00:00:00', endDate: '2026-02-26 00:00:00' })
  })
})
