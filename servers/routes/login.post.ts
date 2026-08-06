import { defineEventHandler, getRequestHeader, getRequestIP, readBody, setResponseStatus } from 'h3'
import { systemStore } from '../utils/system-store'

export default defineEventHandler(async (event) => {
  try {
    const body: any = await readBody(event)
    const meta = {
      ip: getRequestHeader(event, 'x-real-ip') || getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() || getRequestIP(event) || '127.0.0.1',
      userAgent: getRequestHeader(event, 'user-agent'),
    }
    const { type } = body
    if (type === 'mobile') {
      setResponseStatus(event, 501)
      return {
        code: 501,
        msg: '手机验证码登录尚未接入可信验证码服务，请使用账号密码登录',
      }
    }
    else {
      const result = await systemStore.validateLogin(String(body.username ?? ''), String(body.password ?? ''), meta)
      if (result.ok) {
        return {
          code: 200,
          data: { token: result.token },
          msg: '登录成功',
        }
      }
    }

    setResponseStatus(event, 403)
    return {
      code: 401,
      msg: '用户名或密码错误',
    }
  }
  catch (error) {
    console.error('[login] login failed', error)
    setResponseStatus(event, 503)
    return {
      code: 503,
      msg: '登录服务暂不可用，请稍后重试',
    }
  }
})
