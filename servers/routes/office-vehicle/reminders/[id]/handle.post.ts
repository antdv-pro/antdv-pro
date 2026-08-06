import { defineEventHandler, readBody } from 'h3'
import { fail, getOperatorContext, ok } from '../../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../../utils/office-vehicle-store'
import { requireAnyRole } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    return ok(await officeVehicleStore.handleReminder(String(event.context.params?.id), body, getOperatorContext(event)), '已处理提醒')
  }
  catch (error) {
    return fail(error, '处理失败')
  }
})
