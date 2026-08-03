import { defineEventHandler } from 'h3'
import { fail, getOperatorContext, ok } from '../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../utils/office-vehicle-store'

export default defineEventHandler(async (event) => {
  try {
    return ok(await officeVehicleStore.getVehicle(String(event.context.params?.id), getOperatorContext(event)))
  }
  catch (error) {
    return fail(error, '获取失败')
  }
})
