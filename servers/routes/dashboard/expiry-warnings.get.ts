import { defineEventHandler } from 'h3'
import { listExpiryWarnings } from '../../services/dashboard/expiry-warning-service'
import { getOperatorContext, ok } from '../../utils/office-vehicle-context'

export default defineEventHandler(async (event) => {
  return ok(await listExpiryWarnings(getOperatorContext(event)))
})
