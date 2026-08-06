import type { OaModuleState } from '../../utils/oa-module-store'
import type { SystemUser } from '../../utils/system-store'
import type { PositionSalaryTemplate } from '../approval/salary-template-service'
import { calculateSalary } from '../../../shared/salary-calculation'
import { oaModuleStore } from '../../utils/oa-module-store'
import { listPositionSalaryTemplates, positionSalaryKey } from '../approval/salary-template-service'

interface SalaryStateStore {
  getState: () => Promise<OaModuleState>
  replacePartition: (partition: 'salary', rows: unknown, revision: number) => Promise<OaModuleState>
}

const lockedSalaryStatuses = new Set(['待审批', '审批通过', '已锁定', '已发放', '已归档', '已作废'])

export function calculateSalaryRecord(record: Record<string, any>) {
  return calculateSalary(record)
}

function shanghaiPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  return {
    financialYear: Number(parts.find(part => part.type === 'year')?.value),
    financialMonth: Number(parts.find(part => part.type === 'month')?.value),
  }
}

export function isPayrollEligibleUser(user: Pick<SystemUser, 'username' | 'status'>) {
  return user.status === 'enabled' && String(user.username || '').trim().toLowerCase() !== 'admin'
}

export function synchronizeUserSalaryRows(
  rows: Array<Record<string, any>>,
  user: SystemUser,
  date = new Date(),
  template?: PositionSalaryTemplate,
) {
  if (!isPayrollEligibleUser(user))
    return { rows, changed: false }

  const { financialYear, financialMonth } = shanghaiPeriod(date)
  const index = rows.findIndex(row =>
    row.financialYear === financialYear
    && row.financialMonth === financialMonth
    && (String(row.employeeId || '') === user.username || String(row.employeeName || '') === user.nickname),
  )
  const identity = {
    employeeId: user.username,
    employeeName: user.nickname,
    companyName: user.companyName,
    department: user.deptName,
    position: user.postName,
  }
  const salary = template
    ? {
        basicSalary: template.basicSalary,
        performanceSalary: template.performanceSalary,
        senioritySalary: template.senioritySalary,
        overtimeAllowance: template.overtimeAllowance,
        travelAllowance: template.travelAllowance,
        retroactiveSalary: template.retroactiveSalary,
        socialSecurityBase: template.socialSecurityBase,
        tax: template.tax,
        absenceDeductionPerDay: template.absenceDeductionPerDay,
        housingFundBase: 0,
        companyHousingFundRate: 0,
        personalHousingFundRate: 0,
      }
    : {}

  if (index >= 0) {
    const current = rows[index]
    const templateSalary = lockedSalaryStatuses.has(String(current.status || '')) || current.payStatus === '已发放' ? {} : salary
    const changed = Object.entries({ ...identity, ...templateSalary }).some(([key, value]) => current[key] !== value)
    if (!changed)
      return { rows, changed: false }
    const next = [...rows]
    next[index] = Object.keys(templateSalary).length
      ? calculateSalaryRecord({ ...current, ...identity, ...templateSalary })
      : { ...current, ...identity }
    return { rows: next, changed: true }
  }

  const month = String(financialMonth).padStart(2, '0')
  const requiredAttendanceDays = new Date(financialYear, financialMonth, 0).getDate()
  const record: Record<string, any> = {
    id: `salary-${user.username}-${financialYear}${month}`,
    code: `SAL${financialYear}${month}${user.username}`,
    ...identity,
    ...salary,
    sequenceNo: rows.length + 1,
    financialYear,
    financialMonth,
    requiredAttendanceDays,
    actualAttendanceDays: 0,
    attendanceDays: 0,
    attendanceStatus: '待录入',
    basicSalary: 0,
    performanceSalary: 0,
    grossSalary: 0,
    attendanceSalary: 0,
    senioritySalary: 0,
    overtimeAllowance: 0,
    travelAllowance: 0,
    retroactiveSalary: 0,
    totalAmount: 0,
    socialSecurityBase: 0,
    companyPension: 0,
    companyMedical: 0,
    companyInjury: 0,
    companyUnemployment: 0,
    companySocialSecurityTotal: 0,
    personalPension: 0,
    personalMedical: 0,
    personalInjury: 0,
    personalUnemployment: 0,
    personalSocialSecurityTotal: 0,
    tax: 0,
    netSalary: 0,
    cashPayment: '',
    remark: '',
    payStatus: '未发放',
    status: '草稿',
    date: `${financialYear}-${month}-01`,
    createdBy: user.id,
    approverId: 1,
  }
  return { rows: [calculateSalaryRecord(record), ...rows], changed: true }
}

export async function syncUserSalary(user: SystemUser, store: SalaryStateStore = oaModuleStore) {
  return syncUsersSalary([user], store)
}

export async function syncUsersSalary(users: SystemUser[], store: SalaryStateStore = oaModuleStore, date = new Date()) {
  const templates = await listPositionSalaryTemplates()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const state = await store.getState()
    let rows = state.modules.salary
    let changed = false
    for (const user of users) {
      const template = templates.find(item => item.employeeId === user.username)
        || templates.find(item => item.positionKey === positionSalaryKey(user.companyName, user.deptName, user.postName))
      const result = synchronizeUserSalaryRows(rows, user, date, template)
      rows = result.rows
      changed ||= result.changed
    }
    if (!changed)
      return state
    try {
      return await store.replacePartition('salary', rows, Number(state.revision || 0))
    }
    catch (error) {
      if (attempt === 1 || !String(error).includes('其他操作更新'))
        throw error
    }
  }
}
