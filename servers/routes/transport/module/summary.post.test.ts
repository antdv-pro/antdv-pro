import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './summary.post'

const mocks = vi.hoisted(() => ({ body: {} as Record<string, unknown> }))

vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  readBody: vi.fn(async () => mocks.body),
}))

describe('transport module financial summary', () => {
  beforeEach(() => {
    mocks.body = {}
  })

  it('uses the 26th boundary for current and previous financial months', async () => {
    mocks.body = {
      moduleName: 'TransportOrders',
      filters: {
        financialYear: 2026,
        financialMonth: 7,
        periodType: 'financialMonth',
        startDate: '2026-06-26',
        endDate: '2026-07-26',
      },
      rows: [
        { code: 'PREV', shipDate: '2026-06-25', freightTotal: 100, status: '已完成' },
        { code: 'CURRENT-START', shipDate: '2026-06-26', freightTotal: 200, status: '待审核' },
        { code: 'CURRENT-END', shipDate: '2026-07-25', freightTotal: 300, status: '已完成' },
        { code: 'NEXT', shipDate: '2026-07-26', freightTotal: 400, status: '已完成' },
      ],
    }

    const result = await handler({} as any)
    expect(result.data[0]).toMatchObject({
      label: '总订单数',
      value: 2,
      comparison: { previousValue: '1 单', direction: 'up', percent: 100 },
    })
    expect(result.data[1]).toMatchObject({
      value: '¥500',
      comparison: { previousValue: '¥100', direction: 'up', percent: 400 },
    })
  })

  it('compares January with the previous financial month across years', async () => {
    mocks.body = {
      moduleName: 'TransportOrders',
      filters: {
        financialYear: 2027,
        financialMonth: 1,
        periodType: 'financialMonth',
        startDate: '2026-12-26',
        endDate: '2027-01-26',
      },
      rows: [
        { code: 'DEC', shipDate: '2026-12-25', freightTotal: 100 },
        { code: 'JAN', shipDate: '2026-12-26', freightTotal: 100 },
      ],
    }

    const result = await handler({} as any)
    expect(result.data[0].comparison).toEqual({ previousValue: '1 单', direction: 'flat', percent: 0 })
  })

  it('marks an empty filtered result instead of presenting zero as a trend', async () => {
    mocks.body = {
      moduleName: 'TransportOrders',
      filters: { keyword: '不存在的订单' },
      rows: [{ code: 'ORDER-1', freightTotal: 100 }],
    }

    const result = await handler({} as any)
    expect(result.data).toHaveLength(4)
    expect(result.data.every((card: any) => card.dataState === 'empty')).toBe(true)
  })
})
