import { describe, expect, it } from 'vitest'
import { isSalaryEligibleEmployee, isSystemAdministratorSalary } from './salary-organization'

describe('salary organization association', () => {
  const employees = [
    { orgType: '员工', code: 'admin', name: '系统管理员', systemRoles: ['ADMIN'] },
    { orgType: '员工', code: 'manager', name: '业务管理员', systemRoles: ['ADMIN'] },
    { orgType: '员工', code: 'E001', name: '张三', systemRoles: ['USER'] },
    { orgType: '岗位', code: 'P001', name: '会计', systemRoles: [] },
  ]

  it('only allows non-administrator employees into salary templates', () => {
    expect(employees.filter(isSalaryEligibleEmployee).map(item => item.code)).toEqual(['manager', 'E001'])
  })

  it('recognizes administrator salary records by employee id or name', () => {
    expect(isSystemAdministratorSalary({ employeeId: 'admin' }, employees)).toBe(true)
    expect(isSystemAdministratorSalary({ employeeName: '系统管理员' }, employees)).toBe(true)
    expect(isSystemAdministratorSalary({ employeeId: 'E001', employeeName: '张三' }, employees)).toBe(false)
  })
})
