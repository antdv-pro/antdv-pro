import { approvalTemplateService } from '../../../services/approval/template-service'
import { defineApprovalHandler } from '../../../utils/approval-route'

export default defineApprovalHandler('templates', async () => {
  return {
    code: 200,
    msg: '获取成功',
    data: await approvalTemplateService.list(),
  }
})
