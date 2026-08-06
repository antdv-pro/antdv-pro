import { defineEventHandler } from 'h3'
import { systemRoleService } from '../../../services/system/role-service'

export default defineEventHandler(async () => {
  return { code: 200, msg: '获取成功', data: await systemRoleService.list() }
})
