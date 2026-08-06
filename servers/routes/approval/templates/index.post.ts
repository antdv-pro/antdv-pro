import { defineEventHandler, readBody } from 'h3'
import { approvalTemplateService } from '../../../services/approval/template-service'
import { requireAdmin } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  try {
    const body = await readBody(event)
    return {
      code: 200,
      msg: '创建成功',
      data: await approvalTemplateService.create(body),
    }
  }
  catch (error: any) {
    return {
      code: 400,
      msg: error?.message ?? '创建失败',
    }
  }
})
