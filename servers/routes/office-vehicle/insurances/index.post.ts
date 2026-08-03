import { defineEventHandler, readBody } from 'h3'
import { getOperatorContext, ok } from '../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../utils/office-vehicle-store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return ok(await officeVehicleStore.listInsurances({ ...body, ...getOperatorContext(event) }))
})
