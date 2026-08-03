import type { RepaymentRecord, VehicleLoanRecord } from '~/composables/transport-operation-data'
import dayjs from 'dayjs'

import * as XLSX from 'xlsx'

type SheetCell = XLSX.CellObject & { s?: { fgColor?: { rgb?: string, indexed?: number }, fill?: { fgColor?: { rgb?: string, indexed?: number } } } }

function excelDate(value: unknown) {
  if (typeof value === 'number')
    return dayjs('1899-12-30').add(value, 'day').format('YYYY-MM-DD')
  const parsed = dayjs(value as string)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

function isYellow(cell?: SheetCell) {
  const color = cell?.s?.fgColor ?? cell?.s?.fill?.fgColor
  const rgb = String(color?.rgb ?? '').toUpperCase().replace(/^FF/, '')
  return ['FFFF00', 'FFFFCC', 'FFEB9C'].includes(rgb) || color?.indexed === 6
}

function splitVehicleNo(value: unknown) {
  const parts = String(value ?? '').replace(/\s+/g, '').split('/').filter(Boolean)
  return {
    plateNo: parts[0] ?? '',
    trailerNo: parts.slice(1).join('/').replace(/挂$/, '') || undefined,
  }
}

function findValue(rows: unknown[][], label: string) {
  for (const row of rows) {
    const index = row.findIndex(value => String(value ?? '').trim() === label)
    if (index >= 0)
      return row[index + 1]
  }
}

function findPaidPeriods(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })
  const headerRow = rows.findIndex(row => row.some(value => String(value ?? '').trim() === '序号'))
  if (headerRow < 0)
    return new Set<number>()
  return new Set(rows.slice(headerRow + 1)
    .map((row, offset) => ({ periodNo: Number(row[0]), rowNumber: headerRow + offset + 2 }))
    .filter(({ periodNo, rowNumber }) => periodNo > 0 && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].some(column => isYellow(sheet[`${column}${rowNumber}`] as SheetCell)))
    .map(row => row.periodNo))
}

function parsePlanSheet(sheet: XLSX.WorkSheet, id: number, summaryPaidPeriods: Set<number>): VehicleLoanRecord | undefined {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })
  const headerRow = rows.findIndex(row => row.some(value => String(value ?? '').replace(/\s/g, '') === '客户应还金额合计'))
  const contractNo = String(findValue(rows, '租赁合同号') ?? '').trim()
  const vehicle = splitVehicleNo(findValue(rows, '主车车牌号'))
  if (!contractNo || !vehicle.plateNo || headerRow < 0)
    return undefined

  const plan = rows.slice(headerRow + 1)
    .map((row, offset) => ({ row, rowNumber: headerRow + offset + 2 }))
    .filter(({ row }) => Number.isFinite(Number(row[0])) && Number(row[0]) > 0)
  if (!plan.length)
    return undefined

  const payments: RepaymentRecord[] = []
  plan.forEach(({ row, rowNumber }) => {
    const yellow = summaryPaidPeriods.has(Number(row[0]))
      || ['A', 'B', 'C', 'D', 'E', 'F', 'G'].some(column => isYellow(sheet[`${column}${rowNumber}`] as SheetCell))
    if (!yellow)
      return
    payments.push({
      id: payments.length + 1,
      periodNo: Number(row[0]),
      paymentDate: excelDate(row[1]),
      principal: Number(row[2] || 0),
      interest: Number(row[3] || 0),
      amount: Number(row[5] || 0),
      method: '银行转账',
      remark: '由还款计划黄色标记导入',
    })
  })

  const loanAmount = Number(findValue(rows, '计息本金(元)') || 0)
  const totalPeriods = Number(findValue(rows, '租赁期限(月)') || plan.length)
  const first = plan[0].row
  return {
    id,
    contractNo,
    ...vehicle,
    lender: String(findValue(rows, '收款人名称') || '一汽租赁有限公司').trim(),
    loanAmount,
    principalAmount: loanAmount,
    annualRate: 0,
    totalPeriods,
    startDate: excelDate(findValue(rows, '起息日')),
    firstDueDate: excelDate(first[1]),
    monthlyPayment: Number(first[5] || 0),
    owner: String(findValue(rows, '车队') || '').trim(),
    remark: '由车辆还款计划导入',
    payments,
  }
}

export function parseVehicleLoanWorkbook(workbook: XLSX.WorkBook, nextId: number) {
  const summaryPaidPeriods = findPaidPeriods(workbook.Sheets[workbook.SheetNames[0]])
  const planRecords = workbook.SheetNames
    .map((name, index) => parsePlanSheet(workbook.Sheets[name], nextId + index, summaryPaidPeriods))
    .filter((record): record is VehicleLoanRecord => Boolean(record))
  return planRecords.map((record, index) => ({ ...record, id: nextId + index }))
}

export function getLoanApprovalAmount(record: VehicleLoanRecord) {
  const paidPeriods = new Set(record.payments.map(payment => payment.periodNo))
  const nextPeriod = Array.from({ length: record.totalPeriods }, (_, index) => index + 1).find(period => !paidPeriods.has(period))
  if (!nextPeriod)
    return 0
  return Number(record.monthlyPayment || 0)
}
