export interface OaStructuredRecordConfig {
  jsonColumn: 'record_json' | 'balance_json'
  structuredKeys: string[]
  keepSnakeCase?: boolean
  columnAliases?: Record<string, string>
}

const commonAuditKeys = ['createdAt', 'updatedAt']

export const oaStructuredRecordConfigs = {
  dashboard: {
    jsonColumn: 'record_json',
    structuredKeys: ['id', 'code', 'amount', 'status', 'date', 'financialYear', 'financialMonth', ...commonAuditKeys],
  },
  receivable: {
    jsonColumn: 'record_json',
    structuredKeys: ['id', 'code', 'counterparty', 'billType', 'amount', 'paidAmount', 'unpaidAmount', 'dueDate', 'date', 'relatedBill', 'status', 'approvalStatus', 'approvalInstanceId', 'financialYear', 'financialMonth', 'remark', 'createdBy', ...commonAuditKeys],
  },
  cash: {
    jsonColumn: 'record_json',
    structuredKeys: ['id', 'code', 'accountName', 'accountType', 'openingBalance', 'incomeAmount', 'expenseAmount', 'currentBalance', 'date', 'flowType', 'relatedBill', 'handler', 'status', 'approvalStatus', 'approvalInstanceId', 'financialYear', 'financialMonth', 'remark', 'createdBy', ...commonAuditKeys],
  },
  salary: {
    jsonColumn: 'record_json',
    columnAliases: { approval_status: 'status' },
    structuredKeys: ['id', 'code', 'employeeId', 'employeeName', 'companyName', 'department', 'position', 'financialYear', 'financialMonth', 'attendanceDays', 'basicSalary', 'performanceSalary', 'grossSalary', 'attendanceSalary', 'senioritySalary', 'overtimeAllowance', 'travelAllowance', 'retroactiveSalary', 'totalAmount', 'socialSecurityBase', 'companyPension', 'companyMedical', 'companyInjury', 'companyUnemployment', 'companySocialSecurityTotal', 'personalPension', 'personalMedical', 'personalInjury', 'personalUnemployment', 'personalSocialSecurityTotal', 'tax', 'netSalary', 'cashPayment', 'payStatus', 'status', 'approvalInstanceId', 'remark', ...commonAuditKeys],
  },
  org: {
    jsonColumn: 'record_json',
    structuredKeys: ['id', 'code', 'orgType', 'name', 'parentDepartment', 'status', 'date', ...commonAuditKeys],
  },
  vehicle: {
    jsonColumn: 'record_json',
    structuredKeys: ['id', 'code', 'plateNo', 'applicant', 'department', 'totalFee', 'status', 'date', 'financialYear', 'financialMonth', ...commonAuditKeys],
  },
  cashBalance: {
    jsonColumn: 'balance_json',
    keepSnakeCase: true,
    structuredKeys: ['id', 'balance_date', 'company_name', 'bank_name', 'account_name', 'account_no_tail', 'balance_amount', 'remark', 'created_by', 'created_at', 'updated_by', 'updated_at'],
  },
} satisfies Record<string, OaStructuredRecordConfig>

const aliases: Record<string, string> = {
  record_date: 'date',
  bill_date: 'date',
  flow_date: 'date',
  dept_name: 'department',
  post_name: 'position',
}

const numericKeys = new Set([
  'amount',
  'paidAmount',
  'unpaidAmount',
  'financialYear',
  'financialMonth',
  'openingBalance',
  'incomeAmount',
  'expenseAmount',
  'currentBalance',
  'attendanceDays',
  'basicSalary',
  'performanceSalary',
  'grossSalary',
  'attendanceSalary',
  'senioritySalary',
  'overtimeAllowance',
  'travelAllowance',
  'retroactiveSalary',
  'totalAmount',
  'socialSecurityBase',
  'companyPension',
  'companyMedical',
  'companyInjury',
  'companyUnemployment',
  'companySocialSecurityTotal',
  'personalPension',
  'personalMedical',
  'personalInjury',
  'personalUnemployment',
  'personalSocialSecurityTotal',
  'tax',
  'netSalary',
  'cashPayment',
  'totalFee',
  'balance_amount',
])

function camelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function dateValue(value: unknown) {
  if (value instanceof Date)
    return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

export function toOaExtensionRecord(record: Record<string, any>, config: OaStructuredRecordConfig) {
  const structured = new Set(config.structuredKeys)
  return Object.fromEntries(Object.entries(record).filter(([key, value]) => !structured.has(key) && value !== undefined))
}

export function mergeOaStructuredRecord(
  extension: Record<string, any>,
  row: Record<string, any>,
  config: OaStructuredRecordConfig,
) {
  const merged = { ...extension }
  Object.entries(row).forEach(([column, value]) => {
    if (column === config.jsonColumn || column === 'deleted_at' || value == null)
      return
    const key = config.keepSnakeCase ? column : (config.columnAliases?.[column] ?? aliases[column] ?? camelCase(column))
    if (!config.structuredKeys.includes(key))
      return
    if (key === 'id')
      merged[key] = String(value)
    else if (numericKeys.has(key))
      merged[key] = Number(value || 0)
    else if (column.endsWith('_date') || key === 'date' || key === 'dueDate')
      merged[key] = dateValue(value)
    else
      merged[key] = value
  })
  return merged
}
