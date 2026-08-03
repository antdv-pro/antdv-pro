import type { OrderRecord } from '~@/composables/transport-operation-data'
import { financialMonthKey, parseFinancialMonthKey } from '~@/utils/financialPeriod'

export type TransportOrderImportRecord = OrderRecord & Record<string, string>

function importCell(row: Record<string, unknown>, keys: string[]) {
  const key = keys.find(item => row[item] !== undefined && row[item] !== null && row[item] !== '')
  return key ? row[key] : ''
}

function numberValue(value: unknown) {
  if (typeof value === 'number')
    return value
  return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0
}

function parseDate(value: unknown) {
  if (value instanceof Date)
    return value
  if (typeof value === 'number')
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000)
  const raw = String(value ?? '').trim()
  const compact = raw.match(/^(20\d{2})(\d{2})(\d{2})(?:\s+(\d{2})(\d{2}))?$/)
  if (compact) {
    const [, year, month, day, hour = '00', minute = '00'] = compact
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  }
  const date = new Date(raw.replace(/[年月]/g, '/').replace(/日/g, '').replace(/-/g, '/'))
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function formatOrderDate(value: unknown) {
  const date = parseDate(value)
  if (!date)
    return String(value ?? '')
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => index ? String(part).padStart(2, '0') : String(part))
    .join('-')
}

export function normalizeFinanceMonth(value: unknown, businessDate?: unknown) {
  const period = parseFinancialMonthKey(String(value ?? ''))
  if (period)
    return period.key
  const date = parseDate(businessDate)
  return date ? financialMonthKey(date) : ''
}

export function formatOrderWeight(value: unknown) {
  const weight = numberValue(value)
  return weight ? weight.toFixed(2) : ''
}

export function formatOrderRate(value: unknown) {
  const rate = numberValue(value)
  return rate ? `${rate.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : ''
}

function formatMoney(value: unknown, fractionDigits = 2) {
  return `¥${numberValue(value).toLocaleString('zh-CN', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`
}

export function decorateOrderRecord<T extends Record<string, string>>(row: T): T {
  return {
    ...row,
    vehicleDriver: `${row.plateNo || '-'}${row.trailerNo ? ` / ${row.trailerNo}` : ''} / ${row.driver || '-'}${row.escort ? ` / ${row.escort}` : ''}`,
    customerRoute: `${row.customer || '-'} / ${row.routeLine || '-'}`,
    address: `${row.loadingAddress || '-'} 至 ${row.unloadingAddress || '-'}`,
    cargoWeight: `${row.cargoName || '-'} / 发${row.sentWeight || '-'} / 收${row.receivedWeight || '-'}`,
    settlementInfo: `${row.receiptStatus || '-'} / ${row.settlementStatus || '-'}`,
  }
}

export function matrixToRecords(matrix: unknown[][], headerIndex: number) {
  const headers = (matrix[headerIndex] ?? []).map(cell => String(cell || '').trim())
  return matrix.slice(headerIndex + 1).map(cells => headers.reduce<Record<string, unknown>>((row, header, index) => {
    if (header)
      row[header] = cells[index] ?? ''
    return row
  }, {}))
}

export function readOrderRowsFromMatrix(matrix: unknown[][]) {
  const headerIndex = matrix.findIndex(row => row.some(cell => String(cell).trim() === '订单编号'))
  if (headerIndex < 0)
    return []
  const firstHeader = matrix[headerIndex] ?? []
  const secondHeader = matrix[headerIndex + 1] ?? []
  const headers = firstHeader.map((cell, index) => String(secondHeader[index] || cell || '').trim())
  return matrix.slice(headerIndex + 2).map(cells => headers.reduce<Record<string, unknown>>((row, header, index) => {
    if (header)
      row[header] = cells[index] ?? ''
    return row
  }, {}))
}

export function normalizeOrderRows(rawRows: Array<Record<string, unknown>>): TransportOrderImportRecord[] {
  return rawRows.map((row, index) => {
    const freightTotal = importCell(row, ['运费总价', '运费合计', '金额'])
    const code = String(importCell(row, ['订单编号', '运单编号', '订单号']) || '').trim()
    const shipDate = formatOrderDate(importCell(row, ['出车时间', '出车日期', '日期']))
    const price = importCell(row, ['运费单价', '单价'])
    const taxedFreight = importCell(row, ['税后总价', '税后运费'])
    return decorateOrderRecord({
      code: code || `YSIMPORT${index + 1}`,
      status: String(importCell(row, ['订单状态', '状态']) || '待审核'),
      shipDate,
      financeMonth: normalizeFinanceMonth(importCell(row, ['财务月', '月份']), shipDate),
      plateNo: String(importCell(row, ['车辆', '车牌号', '车牌'])).replace(/\s+/g, ''),
      trailerNo: String(importCell(row, ['挂车', '挂车号'])).replace(/\s+/g, ''),
      driver: String(importCell(row, ['司机', '司机姓名'])),
      escort: String(importCell(row, ['押运员', '押运人', '押运员姓名'])),
      customer: String(importCell(row, ['客户', '客户名称'])),
      routeLine: String(importCell(row, ['路线', '运输线路'])),
      loadingAddress: String(importCell(row, ['装货地址', '装货地'])),
      unloadingAddress: String(importCell(row, ['卸货地址', '卸货地'])),
      orderType: String(importCell(row, ['订单类型', '类型'])),
      routeType: String(importCell(row, ['路线类型', '运输类型', '单程/往返']) || '往返双程'),
      cargoName: String(importCell(row, ['货物名称', '货品名称', '货物'])),
      sentWeight: formatOrderWeight(importCell(row, ['货物实发重量', '实发重量'])),
      receivedWeight: formatOrderWeight(importCell(row, ['货物实收重量', '实收重量'])),
      freightPrice: price === '' ? '' : formatMoney(price, 4),
      freightTotal: formatMoney(freightTotal),
      taxRate: formatOrderRate(importCell(row, ['税率'])),
      taxedFreight: taxedFreight === '' ? '' : formatMoney(taxedFreight),
      receiptStatus: String(importCell(row, ['回单状态', '回单']) || '未回单'),
      settlementStatus: String(importCell(row, ['结算状态', '结算']) || '未结算'),
      remark: String(importCell(row, ['备注'])),
    })
  }).filter(row => row.code && row.code !== 'YSIMPORT1' && row.plateNo && row.routeLine && row.freightTotal !== '¥0.00')
}
