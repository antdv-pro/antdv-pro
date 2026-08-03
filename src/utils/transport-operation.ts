import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

export { calculateTransportFreightExcludingTax, TRANSPORT_FREIGHT_TAX_RATE } from '../../shared/transport-freight'

export interface OperationPeriodRecord {
  date: string
  financialYear: number
  financialMonth: number
  plateNo: string
  driver: string
}

export interface OperationQuery {
  financialYear?: number
  financialMonth?: number
  dateRange?: [Dayjs, Dayjs] | null
  plateNo?: string
  driver?: string
}

export interface OperationAggregationLine {
  financialYear: number
  financialMonth: number
  plateNo: string
}

export interface CodedTransportRecord {
  code: string
}

export type TransportFreightFormula = '吨位×单价' | '吨位×运距×单价'

export function getTransportFreightFormula(unitPrice: number): TransportFreightFormula {
  return unitPrice > 1 ? '吨位×单价' : '吨位×运距×单价'
}

export function calculateTransportFreight(
  weight: number,
  distance: number,
  unitPrice: number,
  formula: TransportFreightFormula = getTransportFreightFormula(unitPrice),
) {
  if (weight <= 0 || unitPrice <= 0)
    return 0

  return formula === '吨位×单价'
    ? weight * unitPrice
    : weight * distance * unitPrice
}

export function mergeTransportRecords<T extends CodedTransportRecord>(current: T[], incoming: T[]) {
  const incomingCodes = new Set(incoming.map(record => record.code))
  return [...incoming, ...current.filter(record => !incomingCodes.has(record.code))]
}

/** A fee belongs to the order that closes the interval after the previous order. */
export function isFeeInClosingOrderPeriod(feeTime: number, previousOrderTime: number | undefined, currentOrderTime: number) {
  return feeTime <= currentOrderTime && (previousOrderTime === undefined || feeTime > previousOrderTime)
}

export function normalizeOperationPlateNo(value: unknown) {
  return String(value ?? '').replace(/[\s·.-]+/g, '').toUpperCase()
}

export function operationAggregationKey(record: OperationAggregationLine) {
  return `${record.financialYear}-${record.financialMonth}-${normalizeOperationPlateNo(record.plateNo)}`
}

export function matchesOperationPeriod(record: OperationPeriodRecord, target: OperationPeriodRecord) {
  return record.financialYear === target.financialYear
    && record.financialMonth === target.financialMonth
    && normalizeOperationPlateNo(record.plateNo) === normalizeOperationPlateNo(target.plateNo)
}

export function matchesOperationQuery(record: OperationPeriodRecord, query: OperationQuery) {
  if (query.dateRange?.[0] && query.dateRange?.[1]) {
    if (!record.date)
      return false
    const date = dayjs(record.date)
    if (!date.isValid() || date.isBefore(query.dateRange[0], 'day') || date.isAfter(query.dateRange[1], 'day'))
      return false
  }
  else {
    if (query.financialYear && record.financialYear !== query.financialYear)
      return false
    if (query.financialMonth && record.financialMonth !== query.financialMonth)
      return false
  }

  if (query.plateNo && !normalizeOperationPlateNo(record.plateNo).includes(normalizeOperationPlateNo(query.plateNo)))
    return false
  if (query.driver && !record.driver.includes(query.driver.trim()))
    return false
  return true
}
