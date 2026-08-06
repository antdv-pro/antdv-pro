import { defineEventHandler, getQuery } from 'h3'
import { requireAuthenticatedUser } from '../../../utils/security'
import { transportEtcStore } from '../../../utils/transport-etc-store'

export default defineEventHandler(async (event) => {
  requireAuthenticatedUser(event)
  const query = getQuery(event)
  return {
    code: 200,
    msg: '获取成功',
    data: await transportEtcStore.listPage(query.current, query.pageSize, query),
  }
})
