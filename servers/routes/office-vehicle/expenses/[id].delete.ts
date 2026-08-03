import { defineEventHandler } from 'h3'
import { fail, getOperatorContext, ok } from '../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../utils/office-vehicle-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'])
  try {
    return ok(await officeVehicleStore.deleteExpense(String(event.context.params?.id), getOperatorContext(event)), '删除成功')
  }
  catch (error) {
    return fail(error, '删除失败')
  }
})
