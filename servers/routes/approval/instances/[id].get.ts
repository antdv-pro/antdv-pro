import { createError, defineEventHandler, getRouterParam } from 'h3'
import { approvalInstanceService } from '../../../services/approval/instance-service'
import { requireAuthenticatedUser } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  let detail
  try {
    detail = await approvalInstanceService.getDetail(id)
  }
  catch (error: any) {
    return {
      code: 404,
      msg: error?.message ?? '审批实例不存在',
    }
  }
  const user = requireAuthenticatedUser(event)
  const elevated = user.roles.some(role => ['ADMIN', 'APPROVER', 'FINANCE_MANAGER', 'DEPT_LEADER'].includes(role))
  if (!elevated && !await approvalInstanceService.canView(id, user.id))
    throw createError({ statusCode: 403, statusMessage: '无权查看该审批实例' })
  return { code: 200, msg: '获取成功', data: detail }
})
