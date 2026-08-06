import { defineEventHandler, readBody } from 'h3'
import { requireAuthenticatedUser } from '../../../utils/security'
import { transportEtcStore } from '../../../utils/transport-etc-store'

export default defineEventHandler(async (event) => {
  requireAuthenticatedUser(event)
  const body = await readBody(event)
  return {
    code: 200,
    msg: '新增成功',
    data: await transportEtcStore.createRecord(body),
  }
})
