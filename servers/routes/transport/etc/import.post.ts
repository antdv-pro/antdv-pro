import { defineEventHandler, readBody } from 'h3'
import { requireAuthenticatedUser } from '../../../utils/security'
import { transportEtcStore } from '../../../utils/transport-etc-store'

export default defineEventHandler(async (event) => {
  requireAuthenticatedUser(event)
  const body = await readBody(event)
  return {
    code: 200,
    msg: '导入成功',
    data: await transportEtcStore.importRows(body?.records),
  }
})
