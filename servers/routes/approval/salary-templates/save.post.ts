import { defineEventHandler, readBody } from 'h3'
import { savePositionSalaryTemplate } from '../../../services/approval/salary-template-service'
import { syncUsersSalary } from '../../../services/system/user-salary-sync-service'
import { asBadRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { systemStore } from '../../../utils/system-store'

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER'])
  try {
    const template = await savePositionSalaryTemplate(await readBody(event))
    await syncUsersSalary(await systemStore.listUsers({}) as any[])
    return ok(template, '岗位工资模板已保存并同步工资明细')
  }
  catch (error) {
    return fail(event, asBadRequest(error), '岗位工资模板保存失败')
  }
})
