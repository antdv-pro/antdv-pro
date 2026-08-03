import { describe, expect, it } from 'vitest'
import { maintenancePermissions, officeVehiclePermissions, withoutRecordPermissions } from './permissions'

describe('vehicle business record permissions', () => {
  it('matches office vehicle route roles and locked states', () => {
    expect(officeVehiclePermissions('expense', { approvalStatus: '草稿' }, { roles: ['FINANCE_MANAGER'] }).edit).toBe(true)
    expect(officeVehiclePermissions('expense', { approvalStatus: '审批中' }, { roles: ['FINANCE_MANAGER'] }).edit).toMatchObject({ allowed: false })
    expect(officeVehiclePermissions('vehicle', { status: '正常' }, { roles: ['USER'] }).edit).toMatchObject({ allowed: false })
  })

  it('matches maintenance route roles', () => {
    expect(maintenancePermissions({ status: '待审核' }, { roles: ['DEPT_LEADER'] }).audit).toBe(true)
    expect(maintenancePermissions({ status: '已审核' }, { roles: ['ADMIN'] }).edit).toMatchObject({ allowed: false })
    expect(maintenancePermissions({ status: '待审核' }, { roles: ['USER'] }).edit).toMatchObject({ allowed: false })
  })

  it('removes response-only permissions before persistence', () => {
    expect(withoutRecordPermissions({ id: 1, createdBy: 7, permissions: { edit: true } })).toEqual({ id: 1, createdBy: 7 })
  })
})
