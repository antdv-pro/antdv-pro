export type RegulatoryFeeStatus = '未开始' | '生效中' | '已截止' | '停用'
export type RegulatoryFeeManualStatus = 'enabled' | 'disabled'
export type RegulatoryFeeApprovalStatus = '草稿' | '审批中' | '已确认' | '已驳回' | '已撤回'

export interface RegulatoryFeeModel {
  id?: number
  feeName: string
  feeType: string
  plateNo?: string
  trailerNo?: string
  area?: string
  totalAmount: number
  validStartDate: string
  validEndDate: string
  validMonths: number
  monthlyAmortizedAmount: number
  manualStatus: RegulatoryFeeManualStatus
  status: RegulatoryFeeStatus
  approvalStatus?: RegulatoryFeeApprovalStatus
  approvalInstanceId?: string
  approvedAt?: string
  rejectedAt?: string
  revokedAt?: string
  remark?: string
  attachmentName?: string
  attachmentUrl?: string
  createdAt?: string
  updatedAt?: string
  deletedAt?: string
  permissions?: {
    view?: boolean | { allowed: boolean, reason?: string }
    edit?: boolean | { allowed: boolean, reason?: string }
    delete?: boolean | { allowed: boolean, reason?: string }
    audit?: boolean | { allowed: boolean, reason?: string }
    revoke?: boolean | { allowed: boolean, reason?: string }
    void?: boolean | { allowed: boolean, reason?: string }
    confirmImport?: boolean | { allowed: boolean, reason?: string }
  }
}

export interface RegulatoryFeePayload {
  feeName?: string
  feeType: string
  plateNo?: string
  trailerNo?: string
  area?: string
  totalAmount: number
  validStartDate: string
  validEndDate: string
  remark?: string
  attachmentName?: string
  attachmentUrl?: string
}

export interface RegulatoryFeeQuery {
  current?: number
  pageSize?: number
  plateNo?: string
  trailerNo?: string
  financialYear?: number
  financialMonth?: number
  startDate?: string
  endDate?: string
  feeType?: string
  status?: RegulatoryFeeStatus
}

export interface RegulatoryFeeSummary {
  totalCount: number
  totalAmount: number
  monthlyAmortizedAmount: number
  typeAmounts?: Array<{
    feeType: string
    amount: number
    count: number
  }>
  approvalTotalAmount?: number
  usedAmount?: number
  activeCount: number
  pendingCount: number
  expiredCount: number
  disabledCount: number
  upcomingExpiredCount: number
}

export interface RegulatoryFeeOverviewRow {
  id: number
  plateNo: string
  area: string
  trafficInsurance?: string
  ownerCommercialInsurance?: string
  trailerCommercialInsurance?: string
  vehicleAccidentInsurance?: string
  carrierLiabilityInsurance?: string
  gpsFee?: string
  ownerDrivingPermit?: string
  trailerDrivingPermit?: string
  cylinderYearCheck?: string
  tankCheck?: string
  safetyValveYearCheck?: string
  pressureGaugeCalibration?: string
}

export interface RegulatoryFeeOverviewSummary {
  totalCount: number
  totalAmount: number
}

export interface RegulatoryFeeOverviewResult {
  summary: RegulatoryFeeOverviewSummary
  records: RegulatoryFeeOverviewRow[]
}

export function getRegulatoryFeeListApi(params?: RegulatoryFeeQuery) {
  return usePost<{
    records: RegulatoryFeeModel[]
    total: number
  }>('/transport/fees', params)
}

export function getRegulatoryFeeDetailApi(id: number) {
  return useGet<RegulatoryFeeModel>(`/transport/fees/${id}`)
}

export function createRegulatoryFeeApi(data: RegulatoryFeePayload) {
  return usePost<RegulatoryFeeModel>('/transport/fees/create', data)
}

export function importRegulatoryFeesApi(data: RegulatoryFeePayload[]) {
  return usePost<{ importedCount: number, records: RegulatoryFeeModel[] }>('/transport/fees/import', { records: data })
}

export function updateRegulatoryFeeApi(id: number, data: RegulatoryFeePayload) {
  return usePut<RegulatoryFeeModel>(`/transport/fees/${id}`, data)
}

export function deleteRegulatoryFeeApi(id: number) {
  return useDelete(`/transport/fees/${id}`)
}

export function changeRegulatoryFeeStatusApi(id: number, manualStatus: RegulatoryFeeManualStatus) {
  return usePut<RegulatoryFeeModel>(`/transport/fees/${id}/status`, { manualStatus })
}

export function submitRegulatoryFeeApprovalApi(id: number) {
  return usePost<RegulatoryFeeModel>(`/transport/fees/${id}/submit-approval`)
}

export function checkRegulatoryFeeNameApi(feeName: string, excludeId?: number) {
  return useGet<{ duplicate: boolean }>('/transport/fees/check-name', { feeName, excludeId })
}

export function exportRegulatoryFeeApi(params?: RegulatoryFeeQuery) {
  return usePost<Array<Pick<RegulatoryFeeModel, 'feeType'
    | 'plateNo'
    | 'trailerNo'
    | 'area'
    | 'totalAmount'
    | 'validStartDate'
    | 'validEndDate'
    | 'validMonths'
    | 'monthlyAmortizedAmount'
    | 'status'
    | 'remark'>>>('/transport/fees/export', params)
}

export function getRegulatoryFeeSummaryApi(params?: RegulatoryFeeQuery) {
  return usePost<RegulatoryFeeSummary>('/transport/fees/summary', params)
}

export function getRegulatoryFeeOverviewApi(params?: { plateNo?: string, upcomingOnly?: boolean }) {
  return usePost<RegulatoryFeeOverviewResult>('/transport/fees/overview', params)
}
