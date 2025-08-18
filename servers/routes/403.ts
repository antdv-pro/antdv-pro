import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  event.res.status = 403
  return {
    code: 403,
    msg: '请先登录',
  }
})
