import type { PermissionAwareRecord } from '~@/types/record-permission'

export type VehicleStatus = '正常' | '停用' | '维修中' | '已出售'
export type ExpenseStatus = '草稿' | '待审批' | '审批中' | '已确认' | '已驳回' | '已撤回'
export type DueStatus = '正常' | '即将到期' | '已过期' | '已处理'
export type LicenseStatus = '有效' | '即将到期' | '已过期'

export interface OfficeVehicle extends PermissionAwareRecord {
  id?: string
  plateNo: string
  vehicleType: string
  brandModel: string
  departmentId?: string | number
  departmentName: string
  ownerUserId?: string | number
  ownerName: string
  defaultDriverId?: string | number
  defaultDriverName?: string
  status: VehicleStatus
  purchaseDate?: string
  photoUrl?: string
  remark?: string
  monthExpense?: number
  riskCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface OfficeVehicleExpense extends PermissionAwareRecord {
  id?: string
  vehicleId: string
  plateNo?: string
  expenseType: string
  amount: number
  occurredDate: string
  handlerId?: string | number
  handlerName: string
  departmentId?: string | number
  departmentName: string
  paymentMethod: string
  invoiceNo?: string
  attachmentName?: string
  attachmentUrl?: string
  needApproval: boolean
  approvalStatus: ExpenseStatus
  approvalInstanceId?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface OfficeVehicleLicense extends PermissionAwareRecord {
  id?: string
  vehicleId: string
  plateNo?: string
  licenseType: string
  licenseNo: string
  issueDate?: string
  expiryDate: string
  issuingAuthority?: string
  attachmentName?: string
  attachmentUrl?: string
  status?: LicenseStatus
  remark?: string
}

export interface OfficeVehicleInsurance extends PermissionAwareRecord {
  id?: string
  vehicleId: string
  plateNo?: string
  insuranceType: string
  policyNo: string
  insurer: string
  amount: number
  startDate: string
  endDate: string
  attachmentName?: string
  attachmentUrl?: string
  status?: LicenseStatus
  remark?: string
}

export interface OfficeVehicleReminder extends PermissionAwareRecord {
  id?: string
  vehicleId: string
  plateNo: string
  reminderType: string
  dueDate: string
  remindDays: number
  targetUserIds: Array<string | number>
  targetNames: string[]
  status: DueStatus
  handled: boolean
  handledAt?: string
  handleRemark?: string
  sourceType?: 'license' | 'insurance' | 'maintenance' | 'custom'
  sourceId?: string
}

export interface OfficeVehicleLog {
  id: string
  module: string
  recordId: string
  action: string
  operatorName: string
  content: string
  createdAt: string
}

export interface OfficeVehicleQuery {
  current?: number
  pageSize?: number
  vehicleId?: string
  plateNo?: string
  expenseType?: string
  licenseType?: string
  insuranceType?: string
  reminderType?: string
  departmentName?: string
  status?: string
  startDate?: string
  endDate?: string
  financialYear?: number
  financialMonth?: number
}

export interface PageResult<T> {
  records: T[]
  total: number
}

export interface OfficeVehicleSummary {
  vehicleCount: number
  monthExpense: number
  approvalTotalAmount?: number
  usedAmount?: number
  upcomingReminderCount: number
  expiredReminderCount: number
  confirmedExpense: number
  pendingExpenseCount: number
  byVehicle: Array<{ vehicleId: string, plateNo: string, brandModel: string, amount: number }>
  byMonth: Array<{ month: string, amount: number }>
}

export interface OfficeVehicleDetail {
  vehicle: OfficeVehicle
  expenses: OfficeVehicleExpense[]
  licenses: OfficeVehicleLicense[]
  insurances: OfficeVehicleInsurance[]
  reminders: OfficeVehicleReminder[]
  logs: OfficeVehicleLog[]
}

export interface OfficeVehicleBatchSavePayload {
  vehicle: Partial<OfficeVehicle>
  expenses?: Array<Partial<OfficeVehicleExpense>>
  licenses?: Array<Partial<OfficeVehicleLicense>>
  insurances?: Array<Partial<OfficeVehicleInsurance>>
  reminders?: Array<Partial<OfficeVehicleReminder>>
}

export interface OfficeVehicleBatchSaveResult {
  vehicle: OfficeVehicle
  expenses: OfficeVehicleExpense[]
  licenses: OfficeVehicleLicense[]
  insurances: OfficeVehicleInsurance[]
  reminders: OfficeVehicleReminder[]
}

export function getOfficeVehicleSummaryApi(params?: OfficeVehicleQuery) {
  return usePost<OfficeVehicleSummary>('/office-vehicle/summary', params)
}

export function getOfficeVehicleListApi(params?: OfficeVehicleQuery) {
  return usePost<PageResult<OfficeVehicle>>('/office-vehicle/vehicles', params)
}

export function saveOfficeVehicleApi(data: Partial<OfficeVehicle>) {
  return usePost<OfficeVehicle>('/office-vehicle/vehicles/save', data)
}

export function saveOfficeVehicleBatchApi(data: OfficeVehicleBatchSavePayload) {
  return usePost<OfficeVehicleBatchSaveResult>('/office-vehicle/batch-save', data)
}

export function getOfficeVehicleDetailApi(id: string) {
  return useGet<OfficeVehicleDetail>(`/office-vehicle/vehicles/${id}`)
}

export function deleteOfficeVehicleApi(id: string) {
  return useDelete(`/office-vehicle/vehicles/${id}`)
}

export function getOfficeVehicleExpenseListApi(params?: OfficeVehicleQuery) {
  return usePost<PageResult<OfficeVehicleExpense>>('/office-vehicle/expenses', params)
}

export function saveOfficeVehicleExpenseApi(data: Partial<OfficeVehicleExpense>) {
  return usePost<OfficeVehicleExpense>('/office-vehicle/expenses/save', data)
}

export function deleteOfficeVehicleExpenseApi(id: string) {
  return useDelete(`/office-vehicle/expenses/${id}`)
}

export function submitOfficeVehicleExpenseApprovalApi(id: string) {
  return usePost<OfficeVehicleExpense>(`/office-vehicle/expenses/${id}/submit-approval`)
}

export function changeOfficeVehicleExpenseStatusApi(id: string, status: Extract<ExpenseStatus, '已确认' | '已驳回' | '已撤回'>) {
  return usePut<OfficeVehicleExpense>(`/office-vehicle/expenses/${id}/status`, { status })
}

export function exportOfficeVehicleExpensesApi(params?: OfficeVehicleQuery) {
  return usePost<Record<string, any>[]>('/office-vehicle/expenses/export', params)
}

export function getOfficeVehicleLicenseListApi(params?: OfficeVehicleQuery) {
  return usePost<PageResult<OfficeVehicleLicense>>('/office-vehicle/licenses', params)
}

export function saveOfficeVehicleLicenseApi(data: Partial<OfficeVehicleLicense>) {
  return usePost<OfficeVehicleLicense>('/office-vehicle/licenses/save', data)
}

export function deleteOfficeVehicleLicenseApi(id: string) {
  return useDelete(`/office-vehicle/licenses/${id}`)
}

export function getOfficeVehicleInsuranceListApi(params?: OfficeVehicleQuery) {
  return usePost<PageResult<OfficeVehicleInsurance>>('/office-vehicle/insurances', params)
}

export function saveOfficeVehicleInsuranceApi(data: Partial<OfficeVehicleInsurance>) {
  return usePost<OfficeVehicleInsurance>('/office-vehicle/insurances/save', data)
}

export function getOfficeVehicleReminderListApi(params?: OfficeVehicleQuery) {
  return usePost<PageResult<OfficeVehicleReminder>>('/office-vehicle/reminders', params)
}

export function saveOfficeVehicleReminderApi(data: Partial<OfficeVehicleReminder>) {
  return usePost<OfficeVehicleReminder>('/office-vehicle/reminders/save', data)
}

export function deleteOfficeVehicleReminderApi(id: string) {
  return useDelete(`/office-vehicle/reminders/${id}`)
}

export function handleOfficeVehicleReminderApi(id: string, handleRemark?: string) {
  return usePost<OfficeVehicleReminder>(`/office-vehicle/reminders/${id}/handle`, { handleRemark })
}

export function getOfficeVehicleLogsApi(recordId?: string) {
  return useGet<OfficeVehicleLog[]>('/office-vehicle/logs', { recordId })
}
