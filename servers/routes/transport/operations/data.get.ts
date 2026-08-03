import { defineEventHandler } from 'h3'
import { presentMaintenanceDataset } from '../../../services/vehicle-business/maintenance-records'
import { requireAuthenticatedUser } from '../../../utils/security'
import { getTransportOperationRevision, transportOperationStore } from '../../../utils/transport-operation-store'

export default defineEventHandler(async (event) => {
  const user = requireAuthenticatedUser(event)
  const data = await transportOperationStore.getDataset()
  return {
    code: 200,
    msg: '获取成功',
    data: presentMaintenanceDataset(data, user),
    revision: getTransportOperationRevision(data),
  }
})
