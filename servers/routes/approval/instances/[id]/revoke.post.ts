import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { approvalInstanceService } from '../../../../services/approval/instance-service'
import { requireAuthenticatedUser } from '../../../../utils/security'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')!
    const body = await readBody(event)
    const user = requireAuthenticatedUser(event)
    return {
      code: 200,
      msg: '撤回成功',
      data: await approvalInstanceService.revoke(id, user.id, user.nickname, body.comment),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message ?? '撤回失败',
    }
  }
})
