import { defineEventHandler, getQuery, readRawBody } from 'h3'
import { approvalCallbackService } from '../../../services/approval/callback-service'

export default defineEventHandler(async (event) => {
  try {
    await approvalCallbackService.handleXml(getQuery(event), await readRawBody(event) || '')
    return 'success'
  }
  catch {
    event.res.status = 403
    return 'invalid signature'
  }
})
