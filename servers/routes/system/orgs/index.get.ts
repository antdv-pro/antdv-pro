import { defineEventHandler } from 'h3'
import { systemOrganizationService } from '../../../services/system/organization-service'

export default defineEventHandler(async () => {
  return { code: 200, msg: '获取成功', data: await systemOrganizationService.list() }
})
