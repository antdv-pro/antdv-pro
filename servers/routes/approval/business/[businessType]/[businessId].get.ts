import { createError, defineEventHandler, getRouterParam } from 'h3'
import { approvalInstanceService } from '../../../../services/approval/instance-service'
import { requireAuthenticatedUser } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  const businessType = getRouterParam(event, 'businessType')!
  const businessId = getRouterParam(event, 'businessId')!
  const detail = await approvalInstanceService.getByBusiness(businessType, businessId)
  const user = requireAuthenticatedUser(event)
  const elevated = user.roles.some(role => ['ADMIN', 'APPROVER', 'FINANCE_MANAGER', 'DEPT_LEADER'].includes(role))
  if (detail && !elevated && !await approvalInstanceService.canView(detail.instance.id, user.id))
    throw createError({ statusCode: 403, statusMessage: '无权查看该审批实例' })
  return {
    code: 200,
    msg: '获取成功',
    data: detail,
  }
})
