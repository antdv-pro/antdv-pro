import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

export interface FinancialPeriodRange {
  key: string
  label: string
  startAt: Dayjs
  endAt: Dayjs
  displayEndAt: Dayjs
  startDate: string
  endDate: string
  displayStartDate: string
  displayEndDate: string
}

export type FinancialDateInput = Date | Dayjs | string | number

export interface FinancialPeriodFilterValue {
  financialYear?: number
  financialMonth?: number
  dateRange?: [Dayjs, Dayjs] | null
}

export interface FinancialPeriodQueryParams {
  startDate: string
  endDate: string
  financialYear?: number
  financialMonth?: number
  periodType: 'customRange' | 'financialMonth' | 'financialYear'
}

const DATE_FORMAT = 'YYYY-MM-DD'
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

function toDayjs(value: FinancialDateInput) {
  return dayjs(value)
}

function toRange(key: string, label: string, startAt: Dayjs, endAt: Dayjs): FinancialPeriodRange {
  const displayEndAt = endAt.subtract(1, 'day')

  return {
    key,
    label,
    startAt,
    endAt,
    displayEndAt,
    startDate: startAt.format(DATE_FORMAT),
    endDate: endAt.format(DATE_FORMAT),
    displayStartDate: startAt.format(DATE_FORMAT),
    displayEndDate: displayEndAt.format(DATE_FORMAT),
  }
}

export function getFinancialMonthRange(year: number, month: number): FinancialPeriodRange {
  const naturalMonthStart = dayjs()
    .year(year)
    .month(month - 1)
    .date(1)
    .startOf('day')
  const startAt = naturalMonthStart.subtract(1, 'month').date(26).startOf('day')
  const endAt = naturalMonthStart.date(26).startOf('day')

  return toRange(
    naturalMonthStart.format('YYYYMM'),
    `${year}-${month}`,
    startAt,
    endAt,
  )
}

export function getFinancialYearRange(year: number): FinancialPeriodRange {
  const startAt = dayjs().year(year - 1).month(11).date(26).startOf('day')
  const endAt = dayjs().year(year).month(11).date(26).startOf('day')

  return toRange(`${year}`, `${year}`, startAt, endAt)
}

export function getFinancialMonthByDate(value: FinancialDateInput) {
  const date = toDayjs(value)
  const financialMonth = date.date() >= 26 ? date.add(1, 'month') : date
  return getFinancialMonthRange(financialMonth.year(), financialMonth.month() + 1)
}

export function getFinancialYearByDate(value: FinancialDateInput) {
  const date = toDayjs(value)
  const financialYear = date.month() === 11 && date.date() >= 26 ? date.year() + 1 : date.year()
  return getFinancialYearRange(financialYear)
}

export function formatFinancialMonthLabel(year: number, month: number) {
  return getFinancialMonthRange(year, month).label
}

export function formatFinancialYearLabel(year: number) {
  return getFinancialYearRange(year).label
}

export function getCurrentFinancialMonthRange() {
  return getFinancialMonthByDate(dayjs())
}

export function getCurrentFinancialYearRange() {
  return getFinancialYearByDate(dayjs())
}

export function formatFinancialDisplayRange(range: Pick<FinancialPeriodRange, 'displayStartDate' | 'displayEndDate'>) {
  return `${range.displayStartDate} 至 ${range.displayEndDate}`
}

export function formatFinancialQueryParams(range: Pick<FinancialPeriodRange, 'startDate' | 'endDate'>) {
  return {
    startDate: range.startDate,
    endDate: range.endDate,
  }
}

export function resolveFinancialPeriodQuery(value: FinancialPeriodFilterValue): FinancialPeriodQueryParams {
  if (value.dateRange?.[0] && value.dateRange?.[1]) {
    return {
      startDate: value.dateRange[0].startOf('day').format(DATE_FORMAT),
      endDate: value.dateRange[1].add(1, 'day').startOf('day').format(DATE_FORMAT),
      financialYear: value.financialYear,
      financialMonth: value.financialMonth,
      periodType: 'customRange',
    }
  }

  if (value.financialYear && value.financialMonth) {
    const range = getFinancialMonthRange(value.financialYear, value.financialMonth)
    return {
      ...formatFinancialQueryParams(range),
      financialYear: value.financialYear,
      financialMonth: value.financialMonth,
      periodType: 'financialMonth',
    }
  }

  const year = value.financialYear ?? getCurrentFinancialYearRange().startAt.add(1, 'year').year()
  const range = getFinancialYearRange(year)
  return {
    ...formatFinancialQueryParams(range),
    financialYear: year,
    periodType: 'financialYear',
  }
}

export function formatFinancialQueryDateTime(range: Pick<FinancialPeriodRange, 'startAt' | 'endAt'>) {
  return {
    startDate: range.startAt.format(DATE_TIME_FORMAT),
    endDate: range.endAt.format(DATE_TIME_FORMAT),
  }
}

export function financialMonthKey(value: FinancialDateInput) {
  return getFinancialMonthByDate(value).key
}

export function financialMonthRangeValue(range: Pick<FinancialPeriodRange, 'startAt' | 'displayEndAt'>): [Dayjs, Dayjs] {
  return [range.startAt, range.displayEndAt]
}

export function parseFinancialMonthKey(value: string) {
  const normalized = value.replace(/\D/g, '')
  if (!/^\d{6}$/.test(normalized))
    return undefined

  const year = Number(normalized.slice(0, 4))
  const month = Number(normalized.slice(4, 6))
  if (month < 1 || month > 12)
    return undefined

  return getFinancialMonthRange(year, month)
}
