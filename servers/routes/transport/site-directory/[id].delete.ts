import { defineEventHandler, getRouterParam } from 'h3'
import { siteDirectoryService } from '../../../services/transport/site-directory-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  await siteDirectoryService.remove(Number(getRouterParam(event, 'id')))
  return { code: 200, msg: '删除成功' }
})
