import { describe, expect, it, vi } from 'vitest'
import { synchronizeUserSalaryRows, syncUserSalary, syncUsersSalary } from './user-salary-sync-service'

const user = {
  id: 8,
  username: 'lihua',
  nickname: '李华',
  companyName: '青海诚捷运输有限公司',
  deptName: '运输管理部',
  postName: '调度',
  roles: ['USER'],
  status: 'enabled',
} as any

describe('organization user salary synchronization', () => {
  it('creates the current-month salary detail for an eligible employee', () => {
    const result = synchronizeUserSalaryRows([], user, new Date('2026-07-20T10:00:00Z'))
    expect(result.changed).toBe(true)
    expect(result.rows[0]).toMatchObject({
      employeeId: 'lihua',
      employeeName: '李华',
      financialYear: 2026,
      financialMonth: 7,
      actualAttendanceDays: 0,
      requiredAttendanceDays: 31,
      status: '草稿',
      payStatus: '未发放',
    })
  })

  it('only excludes the built-in administrator account and disabled users', () => {
    expect(synchronizeUserSalaryRows([], { ...user, username: 'admin', roles: ['ADMIN'] }, new Date()).changed).toBe(false)
    expect(synchronizeUserSalaryRows([], { ...user, username: 'manager', roles: ['ADMIN'] }, new Date()).changed).toBe(true)
    expect(synchronizeUserSalaryRows([], { ...user, status: 'disabled' }, new Date()).changed).toBe(false)
  })

  it('updates organization identity without duplicating an existing detail', () => {
    const existing = [{ employeeId: 'lihua', employeeName: '旧姓名', financialYear: 2026, financialMonth: 7, status: '已发放', netSalary: 9000 }]
    const result = synchronizeUserSalaryRows(existing, user, new Date('2026-07-20T10:00:00Z'))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ employeeName: '李华', status: '已发放', netSalary: 9000 })
  })

  it('persists the synchronized salary partition', async () => {
    const replacePartition = vi.fn(async (_partition, rows) => ({ modules: { salary: rows }, cashBalanceRecords: [], revision: 4 }))
    await syncUserSalary(user, {
      getState: vi.fn(async () => ({ modules: { dashboard: [], receivable: [], cash: [], salary: [], org: [], vehicle: [] }, cashBalanceRecords: [], revision: 3 })),
      replacePartition,
    })
    expect(replacePartition).toHaveBeenCalledWith('salary', expect.arrayContaining([expect.objectContaining({ employeeId: 'lihua' })]), 3)
  })

  it('generates the selected financial period instead of only the current month', async () => {
    const replacePartition = vi.fn(async (_partition, rows) => ({ modules: { salary: rows }, cashBalanceRecords: [], revision: 8 }))
    await syncUsersSalary([user], {
      getState: vi.fn(async () => ({ modules: { dashboard: [], receivable: [], cash: [], salary: [], org: [], vehicle: [] }, cashBalanceRecords: [], revision: 7 })),
      replacePartition,
    }, new Date('2025-12-15T12:00:00+08:00'))

    expect(replacePartition).toHaveBeenCalledWith('salary', expect.arrayContaining([
      expect.objectContaining({ employeeId: 'lihua', financialYear: 2025, financialMonth: 12 }),
    ]), 7)
  })
})
