export type ExpiryWarningCategory = '证照' | '保险' | '年检' | '规费' | '车贷' | '应收应付'

export interface ExpiryWarningItem {
  key: string
  recordId: string | number
  sourceType: 'office-license' | 'office-insurance' | 'regulatory-fee' | 'transport-vehicle' | 'vehicle-loan' | 'receivable-payable'
  source: string
  category: ExpiryWarningCategory
  title: string
  target: string
  dueDate: string
  days: number
  route: string
  query: Record<string, string>
}

export function getExpiryWarningsApi() {
  return useGet<ExpiryWarningItem[]>('/dashboard/expiry-warnings')
}
