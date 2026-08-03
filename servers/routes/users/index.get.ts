import { defineEventHandler, getQuery } from 'h3'
import { systemStore } from '../../utils/system-store'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return {
    code: 200,
    msg: '获取成功',
    data: await systemStore.listUsers(query),
  }
})
