import type { FuelRecord } from '~@/composables/transport-operation-data'
import { financialMonthKey } from '~@/utils/financialPeriod'

function normalizeHeader(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

function cellEntry(row: Record<string, unknown>, keys: string[]) {
  const directKey = keys.find(item => row[item] !== undefined && row[item] !== null && row[item] !== '')
  if (directKey)
    return { key: directKey, value: row[directKey] }
  const normalizedKeys = new Set(keys.map(normalizeHeader))
  const matchedKey = Object.keys(row).find(key => normalizedKeys.has(normalizeHeader(key)) && row[key] !== undefined && row[key] !== null && row[key] !== '')
  return matchedKey ? { key: matchedKey, value: row[matchedKey] } : { key: '', value: '' }
}

function cell(row: Record<string, unknown>, keys: string[]) {
  return cellEntry(row, keys).value
}

function numberValue(value: unknown) {
  if (typeof value === 'number')
    return value
  return Number(String(value ?? '').replace(/[^\d.-]/g, '')) || 0
}

export function parseFuelDate(value: unknown) {
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

export function formatFuelDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    month: financialMonthKey(date),
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export function formatFuelAmount(value: unknown) {
  return `¥${numberValue(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function normalizeFuelPlateNo(value: unknown) {
  const plateNo = String(value ?? '').trim().toUpperCase().replace(/[\s·•\-]/g, '')
  return /^[\u4E00-\u9FA5][A-Z][A-Z0-9]{5,7}$/.test(plateNo) ? plateNo : ''
}

function hasHeaders(row: Record<string, unknown>, keys: string[]) {
  const headers = new Set(Object.keys(row).map(normalizeHeader))
  return keys.every(key => headers.has(normalizeHeader(key)))
}

function fallbackFuelCode(provider: 'TTH' | 'FUEL', date: string, plateNo: string, index: number) {
  const dateKey = date.replace(/\D/g, '').slice(0, 8) || 'NODATE'
  return `${provider}-${dateKey}-${plateNo || 'NOPLATE'}-${String(index + 1).padStart(3, '0')}`
}

export function normalizeFuelRows(rawRows: Array<Record<string, unknown>>): FuelRecord[] {
  let inheritedTuotuoheDate = ''
  return rawRows.map((row, index) => {
    const isTuotuohe = hasHeaders(row, ['公斤数量', '车号', '卡内余额'])
    const isHongtong = hasHeaders(row, ['订单编号', '消费站点', '加注开始时间'])
    const rawDate = cell(row, ['订单时间', '交易时间', '日期', '加油时间', '加注开始时间'])
    if (isTuotuohe && String(rawDate).trim())
      inheritedTuotuoheDate = String(rawDate).trim()
    const effectiveDate = isTuotuohe ? (String(rawDate).trim() || inheritedTuotuoheDate) : rawDate
    const parsedDate = parseFuelDate(effectiveDate)
    const formattedDate = parsedDate ? formatFuelDate(parsedDate) : { month: '', date: String(effectiveDate) }
    const amount = cell(row, ['实付金额（元）', '实付金额', '金额', '支付金额', '油品实收金额（元）'])
    const quantityEntry = cellEntry(row, ['油量（升）', '油量', '升数', '加注数量', '公斤数量'])
    const quantity = quantityEntry.value
    const plateNo = normalizeFuelPlateNo(cell(row, ['车牌号', '车牌', '车辆', '企业车牌/企业IC卡', '车号']))
    const quantityUnit: 'L' | 'kg' = isTuotuohe || isHongtong || normalizeHeader(quantityEntry.key) === '公斤数量' ? 'kg' : 'L'
    const directCode = String(cell(row, ['订单编号', '订单号', '交易流水号', '流水号']) || '').trim()
    return {
      code: directCode || fallbackFuelCode(isTuotuohe ? 'TTH' : 'FUEL', formattedDate.date, plateNo, index),
      month: formattedDate.month,
      date: formattedDate.date,
      plateNo,
      location: String(cell(row, ['油站名称', '地点', '加油地点', '站点', '消费站点']) || (isTuotuohe ? '沱沱河' : '')),
      product: String(cell(row, ['油品品号', '商品品类', '油品', '加注类型']) || (isTuotuohe || isHongtong ? 'LNG' : '')),
      quantity: quantity === '' ? '' : `${numberValue(quantity).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}${quantityUnit}`,
      quantityUnit,
      amount: formatFuelAmount(amount),
      driver: String(cell(row, ['会员名称', '司机姓名', '司机'])),
    }
  }).filter(row => row.date && row.plateNo && row.location && row.amount !== '¥0.00')
}
