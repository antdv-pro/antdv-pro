import type { SubmitApprovalPayload, UpsertExternalApprovalPayload } from './types'
import { approvalStore } from '../../utils/approval-store'

export const approvalInstanceRepository = {
  list: (query: Record<string, unknown>) => approvalStore.listInstances(query),
  get: (id: string) => approvalStore.getInstance(id),
  getDetail: (id: string) => approvalStore.getDetail(id),
  canView: (id: string, userId: string | number) => approvalStore.canUserViewInstance(id, userId),
  getByBusiness: (businessType: string, businessId: string) => approvalStore.getByBusiness(businessType, businessId),
  listBusinessRecords: (query: Record<string, unknown>) => approvalStore.listBusinessRecords(query),
  submit: (input: SubmitApprovalPayload) => approvalStore.submit(input),
  upsertExternal: (input: UpsertExternalApprovalPayload) => approvalStore.upsertExternal(input),
  revoke: (id: string, operatorId: string | number, operatorName: string, comment?: string) => approvalStore.revoke(id, operatorId, operatorName, comment),
  archive: (id: string, operatorId: string | number, operatorName: string, reason?: string) => approvalStore.archive(id, operatorId, operatorName, reason),
}
