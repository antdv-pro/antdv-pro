import { defineEventHandler, getQuery } from 'h3'
import { hotelDailyStore } from '../../../utils/hotel-daily-store'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const date = String(query.date || '')
  return {
    code: 200,
    msg: '获取成功',
    data: date ? await hotelDailyStore.get(date) : await hotelDailyStore.list(),
  }
})
