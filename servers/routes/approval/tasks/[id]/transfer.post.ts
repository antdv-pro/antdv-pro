import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { approvalTaskService } from '../../../../services/approval/task-service'
import { requireAuthenticatedUser } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const user = requireAuthenticatedUser(event)
    return {
      code: 200,
      msg: '转交成功',
      data: await approvalTaskService.transfer({ ...body, taskId: getRouterParam(event, 'id')!, operatorId: user.id, operatorName: user.nickname }),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message ?? '转交失败',
    }
  }
})
