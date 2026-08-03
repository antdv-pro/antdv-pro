import { describe, expect, it } from 'vitest'
import { extractEtcSummaryNo, formatEtcAmountFromCents, normalizeEtcRows, parseEtcAmountInCents, validateEtcAmountTotal } from './etc-parser'

describe('eTC import parser', () => {
  it('combines entry and exit stations into one normalized record', () => {
    expect(normalizeEtcRows([{
      交易流水号: 'E001',
      通行时间: '2026-07-16 10:00',
      车牌号: '青A12345',
      入口收费站: '西宁南',
      出口收费站: '湟源',
      通行费: 42.5,
    }])[0]).toMatchObject({
      code: 'E001',
      summaryNo: '',
      name: '西宁南 至 湟源',
      entryInfo: '西宁南',
      exitInfo: '湟源',
      amount: '¥42.50',
    })
  })

  it('rejects invoice header fragments as route names', () => {
    expect(normalizeEtcRows([{ 日期: '2026-07-16', 路线: '价税合计 42.50', 金额: 42.5 }])).toEqual([])
  })

  it('extracts summary numbers with ordinary or non-breaking spaces', () => {
    expect(extractEtcSummaryNo('汇总单号 : 26617903020500031627')).toBe('26617903020500031627')
    expect(extractEtcSummaryNo('汇总单号\u00A0：\u00A026617903020500031628')).toBe('26617903020500031628')
  })

  it('parses and formats ETC money using integer cents', () => {
    expect(parseEtcAmountInCents('￥1,234.50')).toBe(123450)
    expect(parseEtcAmountInCents('0.10')).toBe(10)
    expect(parseEtcAmountInCents('12.345')).toBeUndefined()
    expect(formatEtcAmountFromCents(123450)).toBe('¥1234.50')
  })

  it('requires journey amounts to equal the imported document total exactly', () => {
    expect(validateEtcAmountTotal('1,234.50', ['1,000.00', '234.50'])).toBe(123450)
    expect(() => validateEtcAmountTotal('1,234.50', ['1,000.00', '234.49']))
      .toThrow('金额校验失败：行程合计¥1234.49，票面金额¥1234.50')
  })
})
