import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { approvalInstanceService } from '../../../../services/approval/instance-service'
import { approvalWecomService } from '../../../../services/approval/wecom-service'
import { requireAnyRole, requireAuthenticatedUser } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    requireAnyRole(event, ['ADMIN'])
    const user = requireAuthenticatedUser(event)
    const id = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const detail = await approvalInstanceService.archive(id, user.id, user.nickname, body?.reason)
    approvalWecomService.archiveLocalRecord(id, body?.reason)
    return { code: 200, msg: '已删除并同步归档状态', data: detail }
  }
  catch (error: any) {
    event.res.status = 400
    return { code: 400, msg: error?.message || '删除审批失败' }
  }
})
