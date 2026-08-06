import type mysql from 'mysql2/promise'
import { createHash } from 'node:crypto'
import { getMysqlPool } from '../../utils/mysql'

export const salaryTemplateFields = [
  'basicSalary',
  'performanceSalary',
  'senioritySalary',
  'overtimeAllowance',
  'travelAllowance',
  'retroactiveSalary',
  'socialSecurityBase',
  'tax',
  'absenceDeductionPerDay',
  'housingFundBase',
  'companyHousingFundRate',
  'personalHousingFundRate',
] as const

export interface PositionSalaryTemplate extends Record<string, unknown> {
  id: string
  employeeId: string
  positionKey: string
  companyName: string
  department: string
  position: string
  basicSalary: number
  performanceSalary: number
  senioritySalary: number
  overtimeAllowance: number
  travelAllowance: number
  retroactiveSalary: number
  socialSecurityBase: number
  tax: number
  absenceDeductionPerDay: number
  housingFundBase: number
  companyHousingFundRate: number
  personalHousingFundRate: number
  status: string
  effectiveDate: string
  remark: string
}

const memoryTemplates = new Map<string, PositionSalaryTemplate>()

export function positionSalaryKey(companyName: unknown, department: unknown, position: unknown) {
  return [companyName, department, position].map(value => String(value || '').trim()).join('|')
}

function templateId(key: string) {
  return `post-${createHash('sha1').update(key).digest('hex').slice(0, 32)}`
}

async function ensureTemplateSchema(db: mysql.Pool) {
  const additions = [
    ['position_key', 'VARCHAR(512) NULL'],
    ['company_name', 'VARCHAR(128) NULL'],
    ['department_name', 'VARCHAR(128) NULL'],
    ['position_name', 'VARCHAR(128) NULL'],
    ['absence_deduction_per_day', 'DECIMAL(14,2) NOT NULL DEFAULT 0'],
    ['housing_fund_base', 'DECIMAL(14,2) NOT NULL DEFAULT 0'],
    ['company_housing_fund_rate', 'DECIMAL(8,6) NOT NULL DEFAULT 0'],
    ['personal_housing_fund_rate', 'DECIMAL(8,6) NOT NULL DEFAULT 0'],
  ] as const
  for (const [column, definition] of additions) {
    const [rows] = await db.query<mysql.RowDataPacket[]>('SHOW COLUMNS FROM hr_salary_template LIKE ?', [column])
    if (!rows.length)
      await db.query(`ALTER TABLE hr_salary_template ADD COLUMN ${column} ${definition}`)
  }
}

function fromRow(row: any): PositionSalaryTemplate {
  return {
    id: row.id,
    employeeId: row.employee_id || '',
    positionKey: row.position_key || row.employee_id,
    companyName: row.company_name || '',
    department: row.department_name || '',
    position: row.position_name || '',
    basicSalary: Number(row.basic_salary || 0),
    performanceSalary: Number(row.performance_salary || 0),
    senioritySalary: Number(row.seniority_salary || 0),
    overtimeAllowance: Number(row.overtime_allowance || 0),
    travelAllowance: Number(row.travel_allowance || 0),
    retroactiveSalary: Number(row.retroactive_salary || 0),
    socialSecurityBase: Number(row.social_security_base || 0),
    tax: Number(row.tax || 0),
    absenceDeductionPerDay: Number(row.absence_deduction_per_day || 0),
    housingFundBase: Number(row.housing_fund_base || 0),
    companyHousingFundRate: Number(row.company_housing_fund_rate || 0),
    personalHousingFundRate: Number(row.personal_housing_fund_rate || 0),
    status: row.status || '启用',
    effectiveDate: String(row.effective_date || '').slice(0, 10),
    remark: row.remark || '',
  }
}

export async function listPositionSalaryTemplates() {
  const db = getMysqlPool()
  if (!db)
    return [...memoryTemplates.values()]
  await ensureTemplateSchema(db)
  const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM hr_salary_template WHERE deleted_at IS NULL ORDER BY updated_at DESC')
  return rows.map(fromRow)
}

export async function savePositionSalaryTemplate(input: Record<string, unknown>) {
  const employeeId = String(input.employeeId || '').trim()
  const positionKey = employeeId ? `employee:${employeeId}` : positionSalaryKey(input.companyName, input.department, input.position)
  if (!String(input.position || '').trim())
    throw new Error('岗位不能为空')
  const template: PositionSalaryTemplate = {
    id: templateId(positionKey),
    employeeId,
    positionKey,
    companyName: String(input.companyName || ''),
    department: String(input.department || ''),
    position: String(input.position || ''),
    basicSalary: Number(input.basicSalary || 0),
    performanceSalary: Number(input.performanceSalary || 0),
    senioritySalary: Number(input.senioritySalary || 0),
    overtimeAllowance: Number(input.overtimeAllowance || 0),
    travelAllowance: Number(input.travelAllowance || 0),
    retroactiveSalary: Number(input.retroactiveSalary || 0),
    socialSecurityBase: Number(input.socialSecurityBase || 0),
    tax: Number(input.tax || 0),
    absenceDeductionPerDay: Number(input.absenceDeductionPerDay || 0),
    housingFundBase: 0,
    companyHousingFundRate: 0,
    personalHousingFundRate: 0,
    status: '启用',
    effectiveDate: String(input.effectiveDate || new Date().toISOString().slice(0, 10)),
    remark: String(input.remark || ''),
  }
  if (salaryTemplateFields.some(field => template[field] < 0))
    throw new Error('工资和社保金额不能为负数')

  const db = getMysqlPool()
  if (!db) {
    memoryTemplates.set(positionKey, template)
    return template
  }
  await ensureTemplateSchema(db)
  await db.execute(`
    INSERT INTO hr_salary_template (
      id, employee_id, position_key, company_name, department_name, position_name,
      basic_salary, performance_salary, seniority_salary, overtime_allowance,
      travel_allowance, retroactive_salary, social_security_base, tax, absence_deduction_per_day,
      housing_fund_base, company_housing_fund_rate, personal_housing_fund_rate,
      status, effective_date, remark, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NULL)
    ON DUPLICATE KEY UPDATE position_key=VALUES(position_key), company_name=VALUES(company_name),
      department_name=VALUES(department_name), position_name=VALUES(position_name),
      basic_salary=VALUES(basic_salary), performance_salary=VALUES(performance_salary),
      seniority_salary=VALUES(seniority_salary), overtime_allowance=VALUES(overtime_allowance),
      travel_allowance=VALUES(travel_allowance), retroactive_salary=VALUES(retroactive_salary),
      social_security_base=VALUES(social_security_base), tax=VALUES(tax), absence_deduction_per_day=VALUES(absence_deduction_per_day),
      housing_fund_base=VALUES(housing_fund_base), company_housing_fund_rate=VALUES(company_housing_fund_rate), personal_housing_fund_rate=VALUES(personal_housing_fund_rate), status=VALUES(status),
      effective_date=VALUES(effective_date), remark=VALUES(remark), updated_at=NOW(), deleted_at=NULL
  `, [template.id, template.employeeId || positionKey.slice(0, 64), positionKey, template.companyName, template.department, template.position, template.basicSalary, template.performanceSalary, template.senioritySalary, template.overtimeAllowance, template.travelAllowance, template.retroactiveSalary, template.socialSecurityBase, template.tax, template.absenceDeductionPerDay, template.housingFundBase, template.companyHousingFundRate, template.personalHousingFundRate, template.status, template.effectiveDate || null, template.remark || null])
  return template
}
