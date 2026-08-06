import { describe, expect, it } from 'vitest'
import { filterTransportEtcRows, normalizeTransportEtcManualRecord, summarizeTransportEtcRows } from './transport-etc-store'

const rows = [
  { code: 'E1', summaryNo: 'S1', updatedAt: '2026-07-10', month: '2026-07', plateNo: '青A001', cardNo: 'C1', name: '西宁 至 格尔木', amount: '¥120.50', status: '已导入' },
  { code: 'E2', summaryNo: 'S2', updatedAt: '2026-07-09', month: '2026-07', plateNo: '青A001', cardNo: 'C2', name: '西宁 至 格尔木', amount: '80.00', status: '待审核' },
  { code: 'E3', summaryNo: 'S3', updatedAt: '2026-06-30', month: '2026-06', plateNo: '青A002', cardNo: 'C3', name: '西安 至 宝鸡', amount: '20', status: '已审核' },
]

describe('transport ETC pagination helpers', () => {
  it('filters by indexed period fields and keyword semantics', () => {
    expect(filterTransportEtcRows(rows, { financialYear: 2026, financialMonth: 7 })).toHaveLength(2)
    expect(filterTransportEtcRows(rows, { keyword: 'c2' }).map(row => row.code)).toEqual(['E2'])
    expect(filterTransportEtcRows(rows, { startDate: '2026-07-01', endDate: '2026-07-31', status: '已导入' }).map(row => row.code)).toEqual(['E1'])
  })

  it('builds summaries and route ranking without depending on the current page', () => {
    expect(summarizeTransportEtcRows(rows)).toEqual({
      summary: { recordCount: 3, totalAmount: 220.5, pendingCount: 1, vehicleCount: 2 },
      routeRanking: [
        { route: '西宁 至 格尔木', amount: 200.5, count: 2 },
        { route: '西安 至 宝鸡', amount: 20, count: 1 },
      ],
    })
  })

  it('normalizes a manually entered ETC record', () => {
    expect(normalizeTransportEtcManualRecord({
      code: 'ETC-TEST-1',
      updatedAt: '2026-07-24',
      plateNo: '青H12345',
      entryInfo: '西宁收费站',
      exitInfo: '湟源收费站',
      amount: 88.5,
      cardNo: 'CARD-1',
    })).toMatchObject({
      code: 'ETC-TEST-1',
      month: '2026-07',
      name: '西宁收费站 至 湟源收费站',
      amount: '¥88.50',
      status: '已录入',
      source: 'manual',
    })
  })

  it('rejects incomplete manual ETC records', () => {
    expect(() => normalizeTransportEtcManualRecord({ updatedAt: '2026-02-30', plateNo: '青H12345', entryInfo: 'A', exitInfo: 'B', amount: 10 })).toThrow('通行日期格式无效')
    expect(() => normalizeTransportEtcManualRecord({ updatedAt: '2026-07-24', plateNo: '青H12345', amount: 10 })).toThrow('入口信息和出口信息不能为空')
    expect(() => normalizeTransportEtcManualRecord({ updatedAt: '2026-07-24', plateNo: '青H12345', entryInfo: 'A', exitInfo: 'B', amount: 0 })).toThrow('ETC金额必须大于0')
  })
})
