import { defineEventHandler, getQuery } from 'h3'
import { hotelRevenueStore } from '../../../utils/hotel-revenue-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const user = requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  const query = getQuery(event)
  const date = query.date ? String(query.date) : undefined
  const paginated = query.current !== undefined || query.pageSize !== undefined
  return {
    code: 200,
    msg: '获取成功',
    data: paginated ? await hotelRevenueStore.listPage(date, query.current, query.pageSize, user.companyId) : await hotelRevenueStore.list(date, user.companyId),
  }
})
