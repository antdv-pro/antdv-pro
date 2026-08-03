import { defineEventHandler, getQuery } from 'h3'
import { systemUserService } from '../../../services/system/user-service'

export default defineEventHandler(async (event) => {
  return {
    code: 200,
    msg: '获取成功',
    data: await systemUserService.list(getQuery(event)),
  }
})
