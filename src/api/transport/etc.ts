export interface TransportEtcRecord extends Record<string, unknown> {
  code: string
  storageId?: string
  summaryNo?: string
  name?: string
  entryInfo?: string
  exitInfo?: string
  status?: string
  amount?: string | number
  updatedAt?: string
  month?: string
  plateNo?: string
  invoiceNo?: string
  cardNo?: string
  sourceFileHash?: string
  sourceFileName?: string
  sourceFileRow?: string
}

export interface TransportEtcQuery {
  current?: number
  pageSize?: number
  keyword?: string
  status?: string
  financialYear?: number
  financialMonth?: number
  startDate?: string
  endDate?: string
  includeAnalysis?: boolean
}

export interface TransportEtcActualRouteAnalysis {
  routeCode: string
  routeLine: string
  distance: number | null
  amount: number
  recordCount: number
  estimatedJourneyCount: number
  matchedRecordCount: number
  inferredRecordCount: number
  confidence: '已核对' | '推断' | '待确定'
  matchBasis: string
  corridors: Array<{ route: string, amount: number, recordCount: number }>
}

export interface TransportEtcPage {
  records: TransportEtcRecord[]
  total: number
  current: number
  pageSize: number
  summary: {
    recordCount: number
    totalAmount: number
    pendingCount: number
    vehicleCount: number
  }
  routeRanking: Array<{ route: string, amount: number, count: number }>
  actualRouteAnalysis: TransportEtcActualRouteAnalysis[]
  facets: {
    years: number[]
    statuses: string[]
  }
}

export interface TransportEtcCreatePayload {
  updatedAt: string
  plateNo: string
  entryInfo: string
  exitInfo: string
  amount: number
  summaryNo?: string
  invoiceNo?: string
  cardNo?: string
  status?: string
}

export function getTransportEtcPageApi(params: TransportEtcQuery) {
  return useGet<TransportEtcPage>('/transport/etc', params)
}

export function importTransportEtcApi(records: TransportEtcRecord[]) {
  return usePost<{ importedCount: number }>('/transport/etc/import', { records })
}

export function createTransportEtcRecordApi(payload: TransportEtcCreatePayload) {
  return usePost<TransportEtcRecord>('/transport/etc/create', payload)
}
