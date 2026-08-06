import { defineEventHandler, getQuery } from 'h3'
import { hotelDailyStore } from '../../../utils/hotel-daily-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const query = getQuery(event)
  const date = String(query.date || '')
  return {
    code: 200,
    msg: '获取成功',
    data: date ? await hotelDailyStore.get(date, user.companyId) : await hotelDailyStore.list(user.companyId),
  }
})
