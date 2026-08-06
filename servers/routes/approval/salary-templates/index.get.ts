import { defineEventHandler } from 'h3'
import { listPositionSalaryTemplates } from '../../../services/approval/salary-template-service'
import { ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER', 'APPROVER'])
  return ok(await listPositionSalaryTemplates())
})
