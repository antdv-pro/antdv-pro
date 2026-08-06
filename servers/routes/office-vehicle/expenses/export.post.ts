import { defineEventHandler, readBody } from 'h3'
import { getOperatorContext, ok } from '../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../utils/office-vehicle-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'])
  const body = await readBody(event)
  return ok(await officeVehicleStore.exportExpenses({ ...body, ...getOperatorContext(event) }))
})
