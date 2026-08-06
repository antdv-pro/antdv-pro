import { defineEventHandler } from 'h3'
import { systemRoleService } from '../../../services/system/role-service'

export default defineEventHandler(async (event) => {
  try {
    await systemRoleService.remove(event, String(event.context.params?.id))
    return { code: 200, msg: '删除成功' }
  }
  catch (error: any) {
    event.res.status = 400
    return { code: 400, msg: error?.message || '删除失败' }
  }
})
