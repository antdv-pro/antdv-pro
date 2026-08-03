import { defineEventHandler } from 'h3'
import { syncUsersSalary } from '../../../services/system/user-salary-sync-service'
import { requireAnyRole } from '../../../utils/security'
import { systemStore } from '../../../utils/system-store'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER', 'APPROVER'])
  return {
    code: 200,
    msg: '获取成功',
    data: await syncUsersSalary(await systemStore.listUsers({}) as any[]),
  }
})
