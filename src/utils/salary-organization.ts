type OrganizationEmployee = Record<string, unknown>
type SalaryEmployeeReference = Record<string, unknown>

export function isSystemAdministrator(employee: OrganizationEmployee) {
  return String(employee.code || employee.username || '').trim().toLowerCase() === 'admin'
}

export function isSalaryEligibleEmployee(employee: OrganizationEmployee) {
  return employee.orgType === '员工' && !isSystemAdministrator(employee)
}

export function isSystemAdministratorSalary(
  salary: SalaryEmployeeReference,
  employees: OrganizationEmployee[],
) {
  return employees.some(employee =>
    employee.orgType === '员工'
    && isSystemAdministrator(employee)
    && (
      String(employee.code || '') === String(salary.employeeId || '')
      || String(employee.name || '') === String(salary.employeeName || '')
    ),
  )
}
