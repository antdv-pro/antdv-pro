export interface MaintenanceSummaryParams {
  records: Array<Record<string, any>>
  filters?: Record<string, any>
}

export interface MaintenanceSummary {
  totalCount: number
  totalAmount: number
  pendingCount: number
  repairingCount: number
  approvedCount: number
  averageAmount: number
}

export interface MaintenanceMutationResult extends Record<string, any> {
  id: number
}

export function getMaintenanceSummaryApi(data: MaintenanceSummaryParams) {
  return usePost<MaintenanceSummary>('/transport/maintenance/summary', data)
}

export function createMaintenanceRecordApi(data: Record<string, any>) {
  return usePost<MaintenanceMutationResult>('/transport/maintenance/create', data)
}

export function updateMaintenanceRecordApi(id: number, data: Record<string, any>) {
  return usePut<MaintenanceMutationResult>(`/transport/maintenance/${id}`, data)
}

export function deleteMaintenanceRecordApi(id: number) {
  return useDelete(`/transport/maintenance/${id}`)
}

export function importMaintenanceRecordsApi(records: Array<Record<string, any>>) {
  return usePost<{ records: MaintenanceMutationResult[], importedCount: number }>('/transport/maintenance/import', { records })
}

export function createMaintenanceInventoryApi(data: { movement: Record<string, any>, maintenance?: Record<string, any> }) {
  return usePost<{ movement: Record<string, any>, maintenance?: MaintenanceMutationResult }>('/transport/maintenance/inventory', data)
}
