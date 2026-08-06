import dayjs from 'dayjs'

type TableColumn = Record<string, any>

interface EnhanceBusinessTableOptions {
  actionFields?: string[]
  statusFields?: string[]
  moneyFields?: string[]
  numberFields?: string[]
  dateFields?: string[]
  noSortFields?: string[]
  widthOverrides?: Record<string, number>
}

const defaultActionFields = ['action', 'operation', 'gpsAction']
const defaultStatusFields = ['status', 'approvalStatus', 'payStatus', 'dispatchStatus', 'handled', 'enabled', 'tokenConfigured', 'onlineStatus', 'alarmLevel']
const defaultMoneyFields = [
  'amount',
  'totalAmount',
  'monthlyAmortizedAmount',
  'monthExpense',
  'loanAmount',
  'monthlyPayment',
  'remainingPrincipal',
  'scheduledAmount',
  'scheduledPrincipal',
  'scheduledInterest',
  'paidAmount',
  'paidPrincipal',
  'paidInterest',
  'principal',
  'interest',
  'balance_amount',
  'balanceAmount',
  'incomeAmount',
  'expenseAmount',
  'currentBalance',
  'freightAmount',
  'extraFee',
  'freightTotal',
  'payableTotal',
  'receivableLiquidTotal',
  'liquidPrice',
  'profit',
  'taxedFreight',
  'totalFreight',
  'salaryFee',
  'fuelFee',
  'etcFee',
]
const defaultNumberFields = [
  'id',
  'sortNo',
  'sequenceNo',
  'periodNo',
  'totalPeriods',
  'remainingPeriods',
  'validMonths',
  'riskCount',
  'remindDays',
  'overdueDays',
  'systemCount',
  'customerCount',
  'differenceCount',
  'pieces',
  'weight',
  'loadingTon',
  'unloadingTon',
  'settlementTon',
  'distance',
  'tonKilometer',
  'mileage',
  'orderCount',
  'radius',
  'speed',
  'direction',
  'lng',
  'lat',
  'nodes',
]
const defaultDateFields = ['date', 'time', 'At', 'Date', 'Month', 'Year', 'createdAt', 'updatedAt', 'submittedAt', 'handledAt']
const compactFields = ['id', 'index', 'sequenceNo', 'sortNo', 'type', 'enabled', 'nodes']

export function enhanceBusinessTableColumns(columns: TableColumn[], options: EnhanceBusinessTableOptions = {}) {
  return columns.map((column) => {
    const key = businessColumnKey(column.dataIndex)
    const enhanced: TableColumn = { ...column }
    const existingCustomCell = column.customCell

    enhanced.width = column.width ?? options.widthOverrides?.[key] ?? inferBusinessColumnWidth(column, key, options)
    // Business records must remain fully readable. Widths provide scanning rhythm;
    // wrapping and horizontal scrolling handle constrained containers.
    enhanced.ellipsis = false
    enhanced.customCell = (...args: any[]) => {
      const previous = typeof existingCustomCell === 'function' ? existingCustomCell(...args) : {}
      return {
        ...previous,
        class: [previous?.class, businessTableCellClass(key, options)].filter(Boolean).join(' '),
      }
    }

    if (!enhanced.align) {
      if (isBusinessTableMoneyField(key, options) || isBusinessTableNumberField(key, options))
        enhanced.align = 'right'
      else if (isBusinessTableDateField(key, options) || isBusinessTableField(key, [...defaultStatusFields, ...(options.statusFields ?? []), ...defaultActionFields, ...(options.actionFields ?? [])]))
        enhanced.align = 'center'
    }

    if (key && !enhanced.sorter && !isBusinessTableField(key, [...defaultActionFields, ...(options.actionFields ?? []), ...(options.noSortFields ?? [])]))
      enhanced.sorter = (a: Record<string, any>, b: Record<string, any>) => compareBusinessTableValue(getBusinessTableValue(a, column.dataIndex), getBusinessTableValue(b, column.dataIndex))

    return enhanced
  })
}

export function createBusinessTableScrollX(columns: TableColumn[], minWidth = 900, extraWidth = 24): number {
  const width = columns.reduce<number>((total, column) => {
    if (Array.isArray(column.children))
      return total + createBusinessTableScrollX(column.children, 0, 0)
    const columnWidth = Number.parseFloat(String(column.width ?? '0'))
    return Number.isFinite(columnWidth) ? total + columnWidth : total
  }, 0)
  return Math.max(minWidth, width + extraWidth)
}

export function businessColumnKey(dataIndex: unknown) {
  return Array.isArray(dataIndex) ? String(dataIndex[dataIndex.length - 1] ?? '') : String(dataIndex ?? '')
}

function inferBusinessColumnWidth(column: TableColumn, key: string, options: EnhanceBusinessTableOptions) {
  const title = String(column.title ?? '')
  if (isBusinessTableField(key, [...defaultActionFields, ...(options.actionFields ?? [])]))
    return 180
  if (isBusinessTableField(key, [...defaultStatusFields, ...(options.statusFields ?? [])]))
    return 110
  if (isBusinessTableField(key, compactFields))
    return 80
  if (isBusinessTableMoneyField(key, options))
    return 128
  if (isBusinessTableNumberField(key, options))
    return 100
  if (isBusinessTableDateField(key, options))
    return /time|At/i.test(key) || title.includes('时间') ? 170 : 120
  if (/remark|description|content|message|userAgent|address|route|line|permission|attachment|businessTypes/i.test(key))
    return 220
  if (/code|No|number|invoice|contract|businessId|businessNo/i.test(key))
    return 150
  if (/name|title|company|customer|counterparty|department|module|role/i.test(key))
    return 150

  const visualLength = Array.from(title).reduce((total, char) => total + (/[\u4E00-\u9FA5]/.test(char) ? 2 : 1), 0)
  if (visualLength <= 4)
    return 90
  if (visualLength <= 8)
    return 120
  if (visualLength <= 12)
    return 150
  return 180
}

export function getBusinessTableValue(record: Record<string, any>, dataIndex: unknown) {
  if (Array.isArray(dataIndex))
    return dataIndex.reduce((target, key) => target?.[key], record)
  return record?.[String(dataIndex ?? '')]
}

export function displayBusinessTableValue(value: unknown) {
  if (value == null || value === '')
    return '-'
  return String(value)
}

export function compareBusinessTableValue(a: unknown, b: unknown) {
  const aNumber = toComparableNumber(a)
  const bNumber = toComparableNumber(b)
  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber))
    return aNumber - bNumber

  const aDate = dayjs(String(a ?? ''))
  const bDate = dayjs(String(b ?? ''))
  if (aDate.isValid() && bDate.isValid())
    return aDate.valueOf() - bDate.valueOf()

  return String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN')
}

export function businessTableCellClass(key: string, options: EnhanceBusinessTableOptions = {}) {
  if (isBusinessTableField(key, [...defaultActionFields, ...(options.actionFields ?? [])]))
    return 'table-cell-action'
  if (isBusinessTableField(key, [...defaultStatusFields, ...(options.statusFields ?? [])]))
    return 'table-cell-status'
  if (isBusinessTableMoneyField(key, options))
    return 'table-cell-money'
  if (isBusinessTableNumberField(key, options))
    return 'table-cell-number'
  if (isBusinessTableDateField(key, options))
    return 'table-cell-date'
  return ''
}

function toComparableNumber(value: unknown) {
  return Number(String(value ?? '').replace(/[¥,吨公里%]/g, ''))
}

function isBusinessTableMoneyField(key: string, options: EnhanceBusinessTableOptions) {
  return isBusinessTableField(key, [...defaultMoneyFields, ...(options.moneyFields ?? [])])
}

function isBusinessTableNumberField(key: string, options: EnhanceBusinessTableOptions) {
  return isBusinessTableField(key, [...defaultNumberFields, ...(options.numberFields ?? [])])
}

function isBusinessTableDateField(key: string, options: EnhanceBusinessTableOptions) {
  return [...defaultDateFields, ...(options.dateFields ?? [])].some(field => key.includes(field))
}

function isBusinessTableField(key: string, fields: string[]) {
  return fields.includes(key)
}
