import { defineEventHandler, readBody } from 'h3'
import { syncUsersSalary } from '../../../services/system/user-salary-sync-service'
import { asBadRequest, fail, ok } from '../../../utils/http-response'
import { requireAnyRole } from '../../../utils/security'
import { systemStore } from '../../../utils/system-store'

function salaryPeriodDate(year: unknown, month: unknown) {
  const financialYear = Number(year)
  const financialMonth = Number(month)
  if (!Number.isInteger(financialYear) || financialYear < 2020 || financialYear > 2100)
    throw new Error('财务年不正确')
  if (!Number.isInteger(financialMonth) || financialMonth < 1 || financialMonth > 12)
    throw new Error('财务月不正确')
  return new Date(`${financialYear}-${String(financialMonth).padStart(2, '0')}-15T12:00:00+08:00`)
}

export default defineEventHandler(async (event) => {
  requireAnyRole(event, ['ADMIN', 'FINANCE_MANAGER', 'DEPT_LEADER', 'APPROVER'])
  try {
    const body = await readBody(event)
    const state = await syncUsersSalary(
      await systemStore.listUsers({}) as any[],
      undefined,
      salaryPeriodDate(body?.financialYear, body?.financialMonth),
    )
    return ok(state, '当月工资表已就绪')
  }
  catch (error) {
    return fail(event, asBadRequest(error), '工资表自动生成失败')
  }
})
