import { defineEventHandler } from 'h3'
import { approvalWecomService } from '../../../services/approval/wecom-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return { code: 200, msg: '获取成功', data: approvalWecomService.overview() }
})
