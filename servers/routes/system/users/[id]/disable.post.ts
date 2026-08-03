import { defineEventHandler, readBody } from 'h3'
import { systemUserService } from '../../../../services/system/user-service'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    return {
      code: 200,
      msg: '状态更新成功',
      data: await systemUserService.setStatus(event, Number(event.context.params?.id), body.status),
    }
  }
  catch (error: any) {
    event.res.status = 400
    return { code: 400, msg: error?.message || '状态更新失败' }
  }
})
