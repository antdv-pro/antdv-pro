import type { EtcRecord } from '~@/composables/transport-operation-data'
import { formatFuelAmount, parseFuelDate } from './fuel-parser'
import { formatOrderDate, normalizeFinanceMonth } from './order-parser'

function cell(row: Record<string, unknown>, keys: string[]) {
  const key = keys.find(item => row[item] !== undefined && row[item] !== null && row[item] !== '')
  return key ? row[key] : ''
}

export function normalizeEtcRouteName(value: unknown) {
  const route = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!route)
    return ''
  const invalidFragment = /车牌号码|车牌号|交易金额|购买方|销售方|价税合计|税额|不征税|发票|票据|卡号/
  const amountLike = /(?:^|\s)(?:¥|￥)?\d+(?:\.\d{1,2})?(?:\s|$)/
  return invalidFragment.test(route) || amountLike.test(route) ? '' : route
}

export function extractEtcRoutePair(value: unknown) {
  const parts = String(value ?? '').replace(/\s+/g, ' ').trim().split(/\s*(?:[至→—]|->)\s*/, 2)
  if (parts.length !== 2)
    return ''
  const entry = normalizeEtcRouteName(parts[0])
  const exit = normalizeEtcRouteName(parts[1])
  return entry && exit ? `${entry} 至 ${exit}` : ''
}

export function extractEtcSummaryStations(value: unknown) {
  const lines = String(value ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return lines.flatMap((line, index) => {
    const start = line.match(/([\u4E00-\u9FA5]·[\u4E00-\u9FA5]+)/)?.[1]
    if (!start)
      return []
    const fragments = [start]
    for (let offset = 1; offset <= 4 && index + offset < lines.length; offset += 1) {
      const next = lines[index + offset]
      if (/[\u4E00-\u9FA5]·/.test(next) || /(?:^|\s)20\d{6}(?:\s|$)/.test(next) || /^\d{1,2}\s+(?:至\s+)?[\d,]+\.\d{2}/.test(next))
        break
      const fragment = next.match(/^([\u4E00-\u9FA5]{1,12})(?=\s|$)/)?.[1]
      if (fragment && !/^(?:票|号发|同)$/.test(fragment))
        fragments.push(fragment)
    }
    return [fragments.join('')]
  })
}

export function extractEtcSummaryJourneys(value: unknown) {
  return String(value ?? '').split(/\r?\n/).flatMap((line) => {
    const row = line.trim().match(/^(\d{1,2})(?:\s+20\d{6})?(?:\s+[\u4E00-\u9FA5·]+)*?\s+(?:至\s+)?(\d+(?:,\d{3})*\.\d{2})(?=\s|$)/)
    return row ? [{ index: row[1], amount: row[2] }] : []
  })
}

export function extractEtcSummaryNo(value: unknown) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ')
  const labelIndex = normalized.indexOf('汇总单号')
  if (labelIndex < 0)
    return ''
  const valueText = normalized.slice(labelIndex + '汇总单号'.length).trimStart().replace(/^[:：]/, '').trimStart()
  return valueText.match(/^([A-Z0-9-]{8,64})/i)?.[1] || ''
}

export function parseEtcAmountInCents(value: unknown): number | undefined {
  const normalized = String(value ?? '').trim().replace(/[¥￥,\s]/g, '')
  const matched = normalized.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!matched)
    return undefined
  const cents = Number(matched[2]) * 100 + Number((matched[3] || '').padEnd(2, '0'))
  return matched[1] ? -cents : cents
}

export function formatEtcAmountFromCents(cents: number) {
  const sign = cents < 0 ? '-' : ''
  const absoluteCents = Math.abs(cents)
  return `¥${sign}${Math.floor(absoluteCents / 100)}.${String(absoluteCents % 100).padStart(2, '0')}`
}

export function validateEtcAmountTotal(declaredAmount: unknown, journeyAmounts: unknown[]) {
  const declaredAmountInCents = parseEtcAmountInCents(declaredAmount)
  const journeyAmountsInCents = journeyAmounts.map(parseEtcAmountInCents)
  if (declaredAmountInCents === undefined || journeyAmountsInCents.includes(undefined))
    throw new Error('金额格式异常：ETC金额必须精确到分')
  const journeyTotalInCents = journeyAmountsInCents.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
  if (journeyTotalInCents !== declaredAmountInCents)
    throw new Error(`金额校验失败：行程合计${formatEtcAmountFromCents(journeyTotalInCents)}，票面金额${formatEtcAmountFromCents(declaredAmountInCents)}`)
  return journeyTotalInCents
}

export function formatEtcRoute(entry: unknown, exit: unknown, routeName: unknown) {
  const pair = extractEtcRoutePair(routeName)
  if (pair)
    return pair
  const name = normalizeEtcRouteName(routeName)
  if (name)
    return name
  const entryName = normalizeEtcRouteName(entry)
  const exitName = normalizeEtcRouteName(exit)
  return entryName && exitName ? `${entryName} 至 ${exitName}` : entryName || exitName || '通行费'
}

export function createEtcCode(row: Record<string, unknown>, index: number) {
  const directCode = String(cell(row, ['流水号', '交易流水号', '明细流水号', '费用编号', '编号', 'code']) || '').trim()
  if (directCode)
    return directCode
  const invoiceNo = String(cell(row, ['发票号码', '发票号', '票据号码', 'invoiceNo']) || '').trim()
  const passTime = formatOrderDate(cell(row, ['通行时间', '交易时间', '消费时间', '发生时间', '日期']))
  const cardNo = String(cell(row, ['ETC卡号', '卡号', '通行卡号', 'obu号']) || '').trim()
  const suffix = `${passTime.replace(/\D/g, '')}${String(index + 1).padStart(3, '0')}`
  return `${invoiceNo || cardNo || 'ETCIMPORT'}-${suffix || index + 1}`
}

export function formatEtcDate(value: unknown) {
  const date = parseFuelDate(value)
  if (!date)
    return String(value ?? '')
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function normalizeEtcRecord(row: Record<string, unknown>, index = 0): EtcRecord {
  const passDate = cell(row, ['通行时间', '交易时间', '消费时间', '发生时间', '日期', 'updatedAt'])
  const updatedAt = formatEtcDate(passDate)
  const ownerText = String(cell(row, ['车辆/卡号', '所属信息', 'owner']) || '').trim()
  const ownerParts = ownerText.split('/').map(item => item.trim()).filter(Boolean)
  const plateNo = String(cell(row, ['车牌号', '车牌', '车辆', 'plateNo']) || ownerParts[0] || '').replace(/\s+/g, '')
  const invoiceNo = String(cell(row, ['发票号码', '发票号', '票据号码', 'invoiceNo']) || '').trim()
  const cardNo = String(cell(row, ['ETC卡号', '卡号', '通行卡号', 'obu号', 'cardNo']) || ownerParts[1] || '').trim()
  const routeName = formatEtcRoute(
    cell(row, ['入口站', '入口收费站', '起点', '入口']),
    cell(row, ['出口站', '出口收费站', '终点', '出口']),
    cell(row, ['通行路段', '路段', '路线', 'name']),
  )
  const routeParts = routeName.split(/\s+至\s+/).map(item => item.trim())
  const entryInfo = String(cell(row, ['入口信息', '入口站', '入口收费站', '起点', '入口', 'entryInfo']) || (routeParts.length === 2 ? routeParts[0] : '')).trim()
  const exitInfo = String(cell(row, ['出口信息', '出口站', '出口收费站', '终点', '出口', 'exitInfo']) || (routeParts.length === 2 ? routeParts[1] : '')).trim()
  return {
    code: createEtcCode(row, index),
    summaryNo: String(cell(row, ['汇总单号', 'summaryNo']) || '').trim(),
    name: routeName,
    entryInfo,
    exitInfo,
    owner: ownerText || `${plateNo || '-'} / ${invoiceNo || cardNo || '-'}`,
    status: String(cell(row, ['状态', '匹配状态', 'status']) || '已导入'),
    amount: formatFuelAmount(cell(row, ['价税合计', '金额', '通行费', '费用', '含税金额', 'amount'])),
    updatedAt,
    month: normalizeFinanceMonth(cell(row, ['财务月', '月份', 'month']), updatedAt),
    plateNo,
    invoiceNo,
    cardNo,
  }
}

export function normalizeEtcRows(rawRows: Array<Record<string, unknown>>): EtcRecord[] {
  return rawRows
    .map((row, index) => normalizeEtcRecord(row, index))
    .filter(row => row.code && row.updatedAt && row.amount !== '¥0.00' && (row.plateNo || row.invoiceNo || row.cardNo || row.name !== '通行费'))
}
