import { defineEventHandler, readBody } from 'h3'
import { prepareMaintenanceDataset } from '../../../services/vehicle-business/maintenance-records'
import { asBadRequest, fail } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { getTransportOperationRevision, transportOperationStore } from '../../../utils/transport-operation-store'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'DEPT_LEADER'])
  try {
    const body = await readBody(event)
    const current = await transportOperationStore.getDataset()
    const data = await transportOperationStore.replaceDataset(prepareMaintenanceDataset(body, current, user))
    return {
      code: 200,
      msg: '保存成功',
      data,
      revision: getTransportOperationRevision(data),
    }
  }
  catch (error: any) {
    return fail(event, asBadRequest(error), '运输运营数据保存失败')
  }
})
