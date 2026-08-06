import { defineEventHandler, readBody } from 'h3'
import { fail, getOperatorContext, ok } from '../../../utils/office-vehicle-context'
import { officeVehicleStore } from '../../../utils/office-vehicle-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'OFFICE_ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    return ok(await officeVehicleStore.saveInsurance(body, getOperatorContext(event)), '保存成功')
  }
  catch (error) {
    return fail(error, '保存失败')
  }
})
