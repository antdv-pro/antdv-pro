import type { FinancialDateInput, FinancialPeriodRange } from './financialPeriod'
import {
  financialMonthKey,
  financialMonthRangeValue,
  formatFinancialDisplayRange,
  formatFinancialQueryDateTime,
  getCurrentFinancialMonthRange,
  getCurrentFinancialYearRange,
  getFinancialMonthByDate,
  getFinancialMonthRange,
  getFinancialYearByDate,
  getFinancialYearRange,
  parseFinancialMonthKey,
} from './financialPeriod'

export type FiscalDateInput = FinancialDateInput
export type FiscalPeriod = FinancialPeriodRange

export const getFiscalMonthPeriod = getFinancialMonthRange
export const getFiscalYearPeriod = getFinancialYearRange
export const getFiscalMonthPeriodByDate = getFinancialMonthByDate
export const getFiscalYearPeriodByDate = getFinancialYearByDate
export const getCurrentFiscalMonthPeriod = getCurrentFinancialMonthRange
export const getCurrentFiscalYearPeriod = getCurrentFinancialYearRange
export const formatFiscalDisplayRange = formatFinancialDisplayRange
export const formatFiscalQueryRange = formatFinancialQueryDateTime
export const fiscalMonthKey = financialMonthKey
export const fiscalPeriodRangeValue = financialMonthRangeValue
export const parseFiscalMonthKey = parseFinancialMonthKey

export function fiscalMonthDisplayRange(value: FiscalDateInput) {
  return formatFiscalDisplayRange(getFiscalMonthPeriodByDate(value))
}
