import { defineEventHandler, getQuery } from 'h3'
import { buildTradeOrderAnalytics, tradeOrderStore } from '../../../utils/trade-order-store'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const paginated = query.current !== undefined || query.pageSize !== undefined
  const filters = {
    keyword: query.keyword,
    year: query.year,
    month: query.month,
    status: query.status,
    plateNo: query.plateNo,
    sortField: query.sortField,
    sortOrder: query.sortOrder,
  }
  if (query.all === 'true') {
    return {
      code: 200,
      msg: '获取成功',
      data: await tradeOrderStore.listFiltered(filters),
    }
  }

  if (paginated) {
    const [page, analyticsRows] = await Promise.all([
      tradeOrderStore.listPage(query.current, query.pageSize, filters),
      tradeOrderStore.listFiltered(filters),
    ])
    return {
      code: 200,
      msg: '获取成功',
      data: { ...page, analytics: buildTradeOrderAnalytics(analyticsRows) },
    }
  }

  return {
    code: 200,
    msg: '获取成功',
    data: await tradeOrderStore.list(),
  }
})
