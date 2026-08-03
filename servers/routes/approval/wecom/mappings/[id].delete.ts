import { defineEventHandler, getRouterParam } from 'h3'
import { approvalWecomService } from '../../../../services/approval/wecom-service'
import { requireAdmin } from '../../../../utils/security'

export default defineEventHandler((event) => {
  requireAdmin(event)
  approvalWecomService.removeMapping(getRouterParam(event, 'id') || '')
  return { code: 200, msg: '删除成功', data: true }
})
