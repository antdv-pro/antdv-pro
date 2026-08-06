import { defineEventHandler } from 'h3'
import { siteDirectoryService } from '../../../services/transport/site-directory-service'
import { requireAuthenticatedUser } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAuthenticatedUser(event)
  return { code: 200, msg: '获取成功', data: await siteDirectoryService.list() }
})
