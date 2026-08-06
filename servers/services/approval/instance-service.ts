import { approvalInstanceRepository } from '../../repositories/approval/instance-repository'

export const approvalInstanceService = {
  list: (query: Record<string, unknown>) => approvalInstanceRepository.list(query),
  getDetail: (id: string) => approvalInstanceRepository.getDetail(id),
  canView: (id: string, userId: string | number) => approvalInstanceRepository.canView(id, userId),
  getByBusiness: (businessType: string, businessId: string) => approvalInstanceRepository.getByBusiness(businessType, businessId),
  listBusinessRecords: (query: Record<string, unknown>) => approvalInstanceRepository.listBusinessRecords(query),
  revoke: (id: string, operatorId: string | number, operatorName: string, comment?: string) => approvalInstanceRepository.revoke(id, operatorId, operatorName, comment),
  archive: (id: string, operatorId: string | number, operatorName: string, reason?: string) => approvalInstanceRepository.archive(id, operatorId, operatorName, reason),
}
