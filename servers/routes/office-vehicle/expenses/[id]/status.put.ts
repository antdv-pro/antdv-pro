import { defineEventHandler, readBody } from 'h3'
import { fail, getOperatorContext, ok } from '../../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../../utils/office-vehicle-store'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    return ok(await officeVehicleStore.confirmExpense(String(event.context.params?.id), body.status, getOperatorContext(event)), '状态已更新')
  }
  catch (error) {
    return fail(error, '更新失败')
  }
})
