/* eslint-disable regexp/no-super-linear-backtracking -- input is capped at 250k and patterns match fixed ETC invoice labels */
import type { EtcRecord } from '~@/composables/transport-operation-data'
import { extractEtcSummaryJourneys, extractEtcSummaryNo, extractEtcSummaryStations, normalizeEtcRecord, validateEtcAmountTotal } from './etc-parser'

function matchPdfText(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const matched = text.match(pattern)
    if (matched?.[1])
      return matched[1].trim()
  }
  return ''
}

function normalizePdfAmount(value: string) {
  const matched = value.match(/\d+(?:,\d{3})*(?:\.\d{1,2})?/)
  return matched ? matched[0].replace(/,/g, '') : ''
}

function toNumber(value: unknown) {
  const result = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(result) ? result : 0
}

export function parseEtcSummaryInvoiceStrict(text: string): EtcRecord[] {
  const compactText = text.slice(0, 250_000).replace(/\s+/g, ' ')
  const summaryNo = extractEtcSummaryNo(compactText)
  if (!summaryNo)
    throw new Error('未识别到汇总单号')
  const declaredAmount = normalizePdfAmount(matchPdfText(compactText, [
    /(?:车牌号码|\b车牌号)\s*\S+\s+交易金额\s*(?:¥|￥)?\s*([\d,]+\.\d{2})/,
    /共\d+段行程\s*(?:¥|￥)?\s*([\d,]+\.\d{2})/,
  ]))
  const invoiceNo = matchPdfText(compactText, [
    /\*\s*(\d{16,})/,
    /\d{1,2}\s+\*\s+(\d{16,})\s+[\d,]+(?:\.\d{1,2})?/,
  ])
  const plateNo = matchPdfText(compactText, [
    /(?:车牌号码|车牌号|车牌|车辆)\s*(?:[:：]\s*)?([\u4E00-\u9FA5]\s*[A-Z](?:\s*[A-Z0-9·\-.]){4,8})/i,
  ]).replace(/\s+/g, '').replace(/[.。-]/g, '·')
  const cardNo = matchPdfText(compactText, [
    /(?:ETC卡号|通行卡号|卡号)\s*(?:[:：]\s*)?([A-Z0-9*\-]{5,})/i,
  ])
  const stations = extractEtcSummaryStations(text)
  const declaredJourneyCount = toNumber(matchPdfText(compactText, [/(?:行程数量|行程数)\s*(?:[:：]\s*)?(\d{1,3})/]))
  const journeyRows = extractEtcSummaryJourneys(text)
  const rawDates = [...compactText.matchAll(/(?:^|\s)(20\d{6})(?=\s|$)/g)].map(match => match[1])
  const count = declaredJourneyCount || journeyRows.length

  if (count < 1 || journeyRows.length !== count)
    throw new Error('未识别到ETC汇总票据的出入口明细表')
  if (stations.length < count * 2)
    throw new Error(`出入口数量异常：识别到${stations.length}个，${count}条行程应有${count * 2}个`)
  if (rawDates.length < count * 2)
    throw new Error(`通行日期数量异常：识别到${rawDates.length}个，${count}条拆分明细应有${count * 2}个日期单元`)
  if (!declaredAmount)
    throw new Error('未识别到票面交易金额')
  validateEtcAmountTotal(declaredAmount, journeyRows.map(row => row.amount))

  return journeyRows.map((journey, index) => normalizeEtcRecord({
    编号: `${summaryNo}-${String(index + 1).padStart(3, '0')}`,
    summaryNo,
    通行时间: `${rawDates[index * 2].slice(0, 4)}-${rawDates[index * 2].slice(4, 6)}-${rawDates[index * 2].slice(6, 8)}`,
    入口信息: stations[index * 2],
    出口信息: stations[index * 2 + 1],
    车牌号: plateNo,
    发票号码: invoiceNo,
    ETC卡号: cardNo,
    金额: normalizePdfAmount(journey.amount),
    状态: '已导入',
  }, index))
}
