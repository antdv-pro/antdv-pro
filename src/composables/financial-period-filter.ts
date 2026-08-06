import type { Dayjs } from 'dayjs'
import type { FinancialPeriodFilterValue } from '~@/utils/financialPeriod'
import {
  formatFinancialMonthLabel,
  formatFinancialYearLabel,
  getCurrentFinancialMonthRange,
  getFinancialMonthByDate,
  parseFinancialMonthKey,
  resolveFinancialPeriodQuery,
} from '~@/utils/financialPeriod'

export type FinancialPeriodFilterModel = FinancialPeriodFilterValue

export function createFinancialPeriodFilterModel(initial?: Partial<FinancialPeriodFilterModel>): FinancialPeriodFilterModel {
  const currentMonth = getCurrentFinancialMonthRange()
  const current = getFinancialMonthByDate(currentMonth.startAt)

  return {
    financialYear: Number(current.key.slice(0, 4)),
    financialMonth: undefined,
    dateRange: null,
    ...initial,
  }
}

export function useFinancialPeriodFilter(initial?: Partial<FinancialPeriodFilterModel>) {
  const model = reactive(createFinancialPeriodFilterModel(initial))
  const queryParams = computed(() => resolveFinancialPeriodQuery(model))

  function resetFinancialPeriodFilter(next?: Partial<FinancialPeriodFilterModel>) {
    Object.assign(model, createFinancialPeriodFilterModel(next))
  }

  return {
    model,
    queryParams,
    resetFinancialPeriodFilter,
  }
}

export function createFinancialYearOptions(baseYear = getCurrentFinancialMonthRange().startAt.add(1, 'year').year(), span = 5) {
  return Array.from({ length: span * 2 + 1 }, (_, index) => {
    const year = baseYear - span + index
    return {
      label: formatFinancialYearLabel(year),
      value: year,
    }
  }).reverse()
}

export function createOccurredFinancialYearOptions(monthKeys?: string[]) {
  const years = [...new Set((monthKeys ?? [])
    .map(key => parseFinancialMonthKey(key)?.key.slice(0, 4))
    .filter((year): year is string => Boolean(year)))]
    .sort((a, b) => Number(b) - Number(a))

  return years.map(year => ({
    label: formatFinancialYearLabel(Number(year)),
    value: Number(year),
  }))
}

export function createFinancialMonthOptions(financialYear?: number, monthKeys?: string[]) {
  if (!financialYear)
    return []

  if (monthKeys?.length) {
    return [...new Set(monthKeys)]
      .map(key => parseFinancialMonthKey(key))
      .filter(range => range?.key.startsWith(String(financialYear)))
      .sort((a, b) => Number(b!.key) - Number(a!.key))
      .map((range) => {
        const month = Number(range!.key.slice(4, 6))
        return {
          label: formatFinancialMonthLabel(financialYear, month),
          value: month,
        }
      })
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = 12 - index
    return {
      label: formatFinancialMonthLabel(financialYear, month),
      value: month,
    }
  })
}

export function financialDateRangeValue(value?: [Dayjs, Dayjs] | null) {
  return value ?? null
}
