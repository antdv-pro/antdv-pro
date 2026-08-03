import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { calculateTransportFreight, calculateTransportFreightExcludingTax, getTransportFreightFormula, isFeeInClosingOrderPeriod, matchesOperationPeriod, matchesOperationQuery, mergeTransportRecords, normalizeOperationPlateNo, operationAggregationKey } from './transport-operation'

const julyOrder = {
  date: '2026-07-09',
  financialYear: 2026,
  financialMonth: 7,
  plateNo: '青H75141',
  driver: '马治英',
}

describe('transport operation matching', () => {
  it('calculates freight by unit-price threshold', () => {
    expect(calculateTransportFreight(20, 100, 80)).toBe(1600)
    expect(calculateTransportFreight(20, 100, 0.5)).toBe(1000)
    expect(calculateTransportFreight(20, 100, 1)).toBe(2000)
    expect(calculateTransportFreight(20, 100, 80, '吨位×运距×单价')).toBe(160000)
    expect(calculateTransportFreight(20, 100, 0.5, '吨位×单价')).toBe(10)
    expect(getTransportFreightFormula(1.01)).toBe('吨位×单价')
    expect(getTransportFreightFormula(1)).toBe('吨位×运距×单价')
  })

  it('calculates transport freight excluding 9% tax', () => {
    expect(calculateTransportFreightExcludingTax(1090)).toBeCloseTo(1000)
    expect(calculateTransportFreightExcludingTax(1000)).toBeCloseTo(917.43119266)
    expect(calculateTransportFreightExcludingTax(0)).toBe(0)
  })

  it('merges imported orders without dropping existing records', () => {
    const current = [{ code: 'OLD-1', value: 'kept' }, { code: 'OLD-2', value: 'old' }]
    const incoming = [{ code: 'NEW-1', value: 'new' }, { code: 'OLD-2', value: 'updated' }]

    expect(mergeTransportRecords(current, incoming)).toEqual([
      { code: 'NEW-1', value: 'new' },
      { code: 'OLD-2', value: 'updated' },
      { code: 'OLD-1', value: 'kept' },
    ])
  })

  it('assigns fees after the previous order through the new order date', () => {
    const previousOrder = dayjs('2026-07-10').valueOf()
    const currentOrder = dayjs('2026-07-15').valueOf()

    expect(isFeeInClosingOrderPeriod(dayjs('2026-07-10').valueOf(), previousOrder, currentOrder)).toBe(false)
    expect(isFeeInClosingOrderPeriod(dayjs('2026-07-11').valueOf(), previousOrder, currentOrder)).toBe(true)
    expect(isFeeInClosingOrderPeriod(dayjs('2026-07-15').valueOf(), previousOrder, currentOrder)).toBe(true)
    expect(isFeeInClosingOrderPeriod(dayjs('2026-07-16').valueOf(), previousOrder, currentOrder)).toBe(false)
    expect(isFeeInClosingOrderPeriod(dayjs('2026-07-01').valueOf(), undefined, currentOrder)).toBe(true)
  })

  it('normalizes common plate-number separators consistently', () => {
    expect(normalizeOperationPlateNo(' 青H·75141 ')).toBe('青H75141')
    expect(normalizeOperationPlateNo('青h.75141')).toBe('青H75141')
  })

  it('uses one aggregation key for order and fee variants of the same vehicle', () => {
    const orderKey = operationAggregationKey({ financialYear: 2026, financialMonth: 7, plateNo: '青H75141' })
    const feeKey = operationAggregationKey({ financialYear: 2026, financialMonth: 7, plateNo: '青H·75141' })

    expect(orderKey).toBe(feeKey)
  })

  it('matches the same vehicle and financial period without requiring the same driver text', () => {
    expect(matchesOperationPeriod(julyOrder, { ...julyOrder, plateNo: '青H·75141', driver: '马治英(12)' })).toBe(true)
    expect(matchesOperationPeriod(julyOrder, { ...julyOrder, financialMonth: 6 })).toBe(false)
  })

  it('keeps financial periods isolated across all years and months', () => {
    expect(matchesOperationQuery(julyOrder, { financialYear: 2026, financialMonth: 7 })).toBe(true)
    expect(matchesOperationQuery(julyOrder, { financialYear: 2025, financialMonth: 7 })).toBe(false)
    expect(matchesOperationQuery(julyOrder, { financialYear: 2026, financialMonth: 6 })).toBe(false)
  })

  it('excludes undated vehicle placeholders from a custom date range', () => {
    const range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-07-01'), dayjs('2026-07-10')]
    expect(matchesOperationQuery(julyOrder, { dateRange: range })).toBe(true)
    expect(matchesOperationQuery({ ...julyOrder, date: '' }, { dateRange: range })).toBe(false)
    expect(matchesOperationQuery({ ...julyOrder, date: '2026-06-30' }, { dateRange: range })).toBe(false)
  })

  it('matches plate-number searches using the normalized value', () => {
    expect(matchesOperationQuery(julyOrder, { plateNo: 'H·75141' })).toBe(true)
    expect(matchesOperationQuery(julyOrder, { plateNo: 'H59588' })).toBe(false)
  })
})
