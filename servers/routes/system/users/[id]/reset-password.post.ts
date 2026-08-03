import { defineEventHandler, readBody } from 'h3'
import { systemUserService } from '../../../../services/system/user-service'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    await systemUserService.resetPassword(event, Number(event.context.params?.id), String(body.password || ''))
    return { code: 200, msg: '密码重置成功' }
  }
  catch (error: any) {
    event.res.status = 400
    return { code: 400, msg: error?.message || '密码重置失败' }
  }
})
