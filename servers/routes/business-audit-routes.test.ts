import { beforeEach, describe, expect, it, vi } from 'vitest'

import hotelRevenueHandler from './hotel/revenue/index.put'
import tradeOrdersHandler from './trade/orders/index.put'

const mocks = vi.hoisted(() => ({
  body: {} as Record<string, any>,
  record: vi.fn(),
  trade: {
    list: vi.fn(),
    applyChanges: vi.fn(),
    replace: vi.fn(),
  },
  hotel: {
    list: vi.fn(),
    applyChanges: vi.fn(),
    replaceByDate: vi.fn(),
  },
}))

vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  readBody: vi.fn(async () => mocks.body),
}))
vi.mock('../services/system/log-service', () => ({ systemLogService: { record: mocks.record } }))
vi.mock('../utils/security', () => ({ requireAnyRole: vi.fn() }))
vi.mock('../utils/http-response', () => ({
  asBadRequest: (error: any) => error,
  badRequest: (message: string) => { throw new Error(message) },
  fail: (_event: any, error: any, fallback: string) => ({ code: 400, msg: error?.message || fallback }),
  ok: (data: any, msg: string) => ({ code: 200, msg, data }),
}))
vi.mock('../utils/trade-order-store', () => ({ tradeOrderStore: mocks.trade }))
vi.mock('../utils/hotel-revenue-store', () => ({ hotelRevenueStore: mocks.hotel }))

const event = { context: {}, req: {}, res: {} } as any

describe('business mutation audit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.trade.list.mockResolvedValue([])
    mocks.trade.applyChanges.mockResolvedValue([])
    mocks.hotel.list.mockResolvedValue([])
    mocks.hotel.applyChanges.mockResolvedValue([])
  })

  it('records create, update and delete actions for trade orders', async () => {
    mocks.trade.list.mockResolvedValue([{ code: 'OLD' }])
    mocks.body = {
      upsert: [{ code: 'OLD' }, { code: 'NEW' }],
      deleteCodes: ['DROP'],
    }

    await (tradeOrdersHandler as any)(event)

    expect(mocks.record.mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({ module: '贸易订单', action: 'update', targetId: 'OLD' }),
      expect.objectContaining({ module: '贸易订单', action: 'create', targetId: 'NEW' }),
      expect.objectContaining({ module: '贸易订单', action: 'delete', targetId: 'DROP' }),
    ])
  })

  it('records create and delete actions for hotel revenue', async () => {
    mocks.body = {
      date: '2026-07-19',
      upsert: [{ id: 'R1', type: '收入', amount: 300 }],
      deleteIds: ['R0'],
    }

    await (hotelRevenueHandler as any)(event)

    expect(mocks.record.mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({ module: '酒店流水', action: 'create', targetId: 'R1' }),
      expect.objectContaining({ module: '酒店流水', action: 'delete', targetId: 'R0' }),
    ])
  })
})
