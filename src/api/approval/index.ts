export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'CANCELED'
export type TaskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED' | 'CANCELED'
export type BusinessStatus = 'DRAFT' | 'APPROVAL_PENDING' | 'APPROVAL_APPROVED' | 'APPROVAL_REJECTED' | 'APPROVAL_REVOKED'

export interface ApprovalNodeTemplate {
  id: string
  name: string
  order: number
  approverType: 'USER' | 'ROLE'
  approverIds: Array<string | number>
}

export interface ApprovalTemplate {
  id: string
  name: string
  businessTypes: string[]
  enabled: boolean
  nodes: ApprovalNodeTemplate[]
  createdAt: string
  updatedAt: string
}

export interface ApprovalInstance {
  id: string
  code: string
  templateId: string
  approvalType: string
  businessModule?: string
  businessType: string
  businessId: string
  businessNo: string
  title: string
  applicantId: string | number
  applicantName: string
  deptId?: string | number
  deptName?: string
  amount?: number
  status: ApprovalStatus
  businessStatus: BusinessStatus
  currentNodeId?: string
  currentNodeName?: string
  payload?: Record<string, any>
  formSnapshot?: Record<string, any>
  ccUserIds: Array<string | number>
  createdAt: string
  updatedAt: string
  submittedAt: string
  approvedAt?: string
  rejectedAt?: string
  revokedAt?: string
  businessAppliedAt?: string
}

export interface ApprovalTask {
  id: string
  instanceId: string
  nodeId: string
  nodeName: string
  assigneeId: string | number
  assigneeName: string
  status: TaskStatus
  comment?: string
  actedAt?: string
  instance?: ApprovalInstance
}

export interface ApprovalDetail {
  instance: ApprovalInstance
  nodes: any[]
  tasks: ApprovalTask[]
  logs: any[]
  ccs: any[]
  business?: any
}

export interface OaModuleState {
  modules: Record<string, Array<Record<string, any>>>
  cashBalanceRecords: Array<Record<string, any>>
  revision?: number
}

export interface SubmitApprovalParams {
  templateId?: string
  approvalType?: string
  businessModule?: string
  businessType: string
  businessId: string
  businessNo: string
  title: string
  applicantId: string | number
  applicantName: string
  deptId?: string | number
  deptName?: string
  amount?: number
  formData?: Record<string, any>
  ccUserIds?: Array<string | number>
}

export function getApprovalTemplatesApi() {
  return useGet<ApprovalTemplate[]>('/approval/templates')
}

export function createApprovalTemplateApi(data: Pick<ApprovalTemplate, 'name' | 'businessTypes' | 'nodes'>) {
  return usePost<ApprovalTemplate>('/approval/templates', data)
}

export function submitApprovalApi(data: SubmitApprovalParams) {
  return usePost<ApprovalDetail, SubmitApprovalParams>('/approval/instances/submit', data)
}

export function getApprovalInstancesApi(params?: Record<string, any>) {
  return useGet<ApprovalInstance[]>('/approval/instances', params)
}

export function getApprovalDetailApi(id: string) {
  return useGet<ApprovalDetail>(`/approval/instances/${id}`)
}

export function revokeApprovalApi(id: string, data: { operatorId: string | number, operatorName: string, comment?: string }) {
  return usePost<ApprovalDetail>(`/approval/instances/${id}/revoke`, data)
}

export function archiveApprovalApi(id: string, reason: string) {
  return usePost<ApprovalDetail>(`/approval/instances/${id}/archive`, { reason })
}

export function getApprovalTodoApi(userId: string | number, params?: Record<string, any>) {
  return useGet<ApprovalTask[]>('/approval/tasks/todo', { userId, ...params })
}

export function getApprovalDoneApi(userId: string | number, params?: Record<string, any>) {
  return useGet<ApprovalTask[]>('/approval/tasks/done', { userId, ...params })
}

export function getApprovalSubmittedApi(userId: string | number, params?: Record<string, any>) {
  return useGet<ApprovalInstance[]>('/approval/tasks/submitted', { userId, ...params })
}

export function getApprovalCcApi(userId: string | number, params?: Record<string, any>) {
  return useGet<any[]>('/approval/cc/mine', { userId, ...params })
}

export function approveTaskApi(id: string, data: { operatorId: string | number, operatorName: string, comment?: string }) {
  return usePost<ApprovalDetail>(`/approval/tasks/${id}/approve`, data)
}

export function rejectTaskApi(id: string, data: { operatorId: string | number, operatorName: string, comment?: string }) {
  return usePost<ApprovalDetail>(`/approval/tasks/${id}/reject`, data)
}

export function transferTaskApi(id: string, data: { operatorId: string | number, operatorName: string, toUserId: string | number, toUserName: string, comment?: string }) {
  return usePost<ApprovalDetail>(`/approval/tasks/${id}/transfer`, data)
}

export function getApprovalByBusinessApi(businessType: string, businessId: string) {
  return useGet<ApprovalDetail | null>(`/approval/business/${businessType}/${businessId}`)
}

export function getApprovalBusinessRecordsApi(params?: Record<string, any>) {
  return useGet<any[]>('/approval/business-records', params)
}

export function getOaModuleStateApi() {
  return useGet<OaModuleState>('/approval/oa-module/data')
}

export function saveOaModuleStateApi(data: OaModuleState) {
  return usePut<OaModuleState>('/approval/oa-module/data', data)
}

export function saveOaModulePartitionApi(data: { partition: string, rows: Array<Record<string, any>>, revision: number }) {
  return usePut<OaModuleState>('/approval/oa-module/data', data)
}

export function getSalaryTemplatesApi() {
  return useGet<any[]>('/approval/salary-templates')
}

export function saveSalaryTemplateApi(data: Record<string, any>) {
  return usePost<any, Record<string, any>>('/approval/salary-templates/save', data)
}

export function generateSalaryPeriodApi(data: { financialYear: number, financialMonth: number }) {
  return usePost<OaModuleState, typeof data>('/approval/salary/generate', data)
}

export interface RegisterReceiptParams {
  cashBalanceId?: string
  accountName: string
  amount: number
  receiptDate: string
  payerName: string
  bankSerialNo: string
  accountType?: string
  receiptType?: string
  handler?: string
  remark?: string
}

export interface ReceiptAllocationParams {
  receivableId: string
  amount: number
  remark?: string
}

export function registerReceiptApi(data: RegisterReceiptParams) {
  return usePost('/approval/finance/receipts', data)
}

export function allocateReceiptApi(id: string, data: {
  allocations: ReceiptAllocationParams[]
  cashBalanceId: string
  allocationBatchId: string
  handler?: string
}) {
  return usePost(`/approval/finance/receipts/${id}/allocate`, data)
}

export interface PaymentAllocationParams {
  payableId: string
  amount: number
  remark?: string
}

export interface CreatePaymentParams {
  paymentRequestNo: string
  cashBalanceId: string
  companyName: string
  accountNo: string
  accountName: string
  paymentDate: string
  payeeName: string
  allocations: PaymentAllocationParams[]
  accountType?: string
  paymentMethod?: string
  handler?: string
  remark?: string
}

export function createPaymentApi(data: CreatePaymentParams) {
  return usePost('/approval/finance/payments', data)
}

export function confirmPaymentApi(id: string, data: { bankSerialNo: string, paidAt?: string, handler?: string }) {
  return usePost(`/approval/finance/payments/${id}/confirm`, data)
}

export function submitPaymentApi(id: string) {
  return usePost(`/approval/finance/payments/${id}/submit`)
}

export function failPaymentApi(id: string, reason: string) {
  return usePost(`/approval/finance/payments/${id}/fail`, { reason })
}

export interface FinanceReconciliationResult {
  approvedCount: number
  missingCount: number
  repairedCount?: number
  missing: Array<{ approvalId: string, approvalCode: string, businessType: string, title: string, amount: number, target: string }>
}

export function getFinanceReconciliationApi() {
  return useGet<FinanceReconciliationResult>('/approval/finance/reconciliation')
}

export function reconcileFinanceRecordsApi() {
  return usePost<FinanceReconciliationResult>('/approval/finance/reconciliation')
}

export interface WecomApprovalOverview {
  config: Record<string, any>
  mappings: Array<Record<string, any>>
  records: Array<Record<string, any>>
  sync: Record<string, any>
}

export function getWecomApprovalOverviewApi() {
  return useGet<WecomApprovalOverview>('/approval/wecom')
}

export function saveWecomApprovalConfigApi(data: Record<string, any>) {
  return usePut('/approval/wecom/config', data)
}

export function testWecomApprovalConnectionApi() {
  return usePost<boolean>('/approval/wecom/test', undefined, { errorNotification: false })
}

export function saveWecomApprovalMappingApi(data: Record<string, any>) {
  return usePost('/approval/wecom/mappings', data)
}

export function deleteWecomApprovalMappingApi(id: string) {
  return useDelete(`/approval/wecom/mappings/${id}`)
}

export function syncWecomApprovalApi(spNo: string, localInstanceId?: string) {
  return usePost('/approval/wecom/sync', { spNo, localInstanceId })
}

export function syncWecomApprovalRangeApi(data: { incremental?: boolean, days?: number, startTime?: number, endTime?: number }) {
  return usePost('/approval/wecom/sync-range', data)
}

export function pushWecomApprovalApi(localInstanceId: string) {
  return usePost('/approval/wecom/push', { localInstanceId })
}
