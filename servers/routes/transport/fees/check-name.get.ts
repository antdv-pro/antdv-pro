import { defineEventHandler, getQuery } from 'h3'
import { isDuplicateFeeName } from '../../../utils/regulatory-fee-store'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const feeName = String(query.feeName || '')
  const excludeId = query.excludeId ? Number(query.excludeId) : undefined

  return {
    code: 200,
    msg: '校验成功',
    data: {
      duplicate: await isDuplicateFeeName(feeName, excludeId),
    },
  }
})
