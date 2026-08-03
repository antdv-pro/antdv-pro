import { defineEventHandler, readBody } from 'h3'
import { hotelDailyStore } from '../../../utils/hotel-daily-store'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const body = await readBody(event)
    return {
      code: 200,
      msg: '保存成功',
      data: await hotelDailyStore.save(body),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message || '保存失败',
    }
  }
})
