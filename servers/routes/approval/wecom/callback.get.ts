import { defineEventHandler, getQuery } from 'h3'
import { approvalCallbackService } from '../../../services/approval/callback-service'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  try {
    return approvalCallbackService.verifyUrl(query, String(query.echostr || ''))
  }
  catch {
    event.res.status = 403
    return 'invalid signature'
  }
})
