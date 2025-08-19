import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  // setResponseStatus(event, 401)
  event.res.status = 401
  return {
    code: 401,
    msg: '请先登录',
  }
})
