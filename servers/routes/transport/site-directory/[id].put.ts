import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { siteDirectoryService } from '../../../services/transport/site-directory-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)
  return { code: 200, msg: '保存成功', data: await siteDirectoryService.save(Number(getRouterParam(event, 'id')), await readBody(event), user.id) }
})
