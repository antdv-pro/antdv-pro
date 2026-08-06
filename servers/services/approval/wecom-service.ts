import { wecomApprovalStore } from '../../utils/wecom-approval-store'

export const approvalWecomService = {
  overview: () => wecomApprovalStore.getOverview(),
  saveConfig: (input: Parameters<typeof wecomApprovalStore.saveConfig>[0]) => wecomApprovalStore.saveConfig(input),
  testConnection: () => wecomApprovalStore.testConnection(),
  saveMapping: (input: Parameters<typeof wecomApprovalStore.saveMapping>[0]) => wecomApprovalStore.saveMapping(input),
  removeMapping: (id: string) => wecomApprovalStore.removeMapping(id),
  syncApproval: (spNo: string, localInstanceId?: string) => wecomApprovalStore.syncApproval(spNo, localInstanceId),
  syncRange: (input: Parameters<typeof wecomApprovalStore.syncRange>[0]) => wecomApprovalStore.syncRange(input),
  syncIncremental: () => wecomApprovalStore.syncIncremental(),
  archiveLocalRecord: (id: string, reason?: string) => wecomApprovalStore.archiveLocalRecord(id, reason),
}
