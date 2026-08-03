import { defineEventHandler, readBody } from 'h3'
import { requireAuthenticatedUser } from '../../../utils/security'
import { transportFuelStore } from '../../../utils/transport-fuel-store'

export default defineEventHandler(async (event) => {
  requireAuthenticatedUser(event)
  const body = await readBody(event)
  return {
    code: 200,
    msg: '新增成功',
    data: await transportFuelStore.createRecord(body),
  }
})
