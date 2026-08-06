import type { SummaryDataState } from '~@/components/summary-cards/index.vue'
import type { FinancialComparison } from '~@/utils/financial-comparison'

export interface TransportSummaryCard {
  label: string
  value: string | number
  hint?: string
  comparison?: FinancialComparison
  tag?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  dataState?: SummaryDataState
}

export function getTransportModuleSummaryApi(data: {
  moduleName: string
  rows: Array<Record<string, any>>
  filters?: Record<string, any>
}) {
  return usePost<TransportSummaryCard[]>('/transport/module/summary', data)
}
