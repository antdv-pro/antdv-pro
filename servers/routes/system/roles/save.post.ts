import { defineEventHandler, readBody } from 'h3'
import { systemRoleService } from '../../../services/system/role-service'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    return { code: 200, msg: '保存成功', data: await systemRoleService.save(event, body) }
  }
  catch (error: any) {
    event.res.status = 400
    return { code: 400, msg: error?.message || '保存失败' }
  }
})
