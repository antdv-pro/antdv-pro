import { beforeEach, describe, expect, it, vi } from 'vitest'

import getDaily from './index.get'
import putDaily from './index.put'

const mocks = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>,
  user: { id: 1, companyId: 9, deptId: 'hotel', roles: ['ADMIN'] },
  store: { list: vi.fn(), get: vi.fn(), save: vi.fn() },
}))

vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  getQuery: () => mocks.query,
  readBody: async () => mocks.body,
}))
vi.mock('../../../utils/security', () => ({ requireAnyRole: () => mocks.user }))
vi.mock('../../../utils/hotel-daily-store', () => ({ hotelDailyStore: mocks.store }))

describe('hotel daily company scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.query = {}
    mocks.body = { date: '2026-01-03', occupiedRooms: 12 }
    mocks.store.list.mockResolvedValue([])
    mocks.store.get.mockResolvedValue(null)
    mocks.store.save.mockResolvedValue({ date: '2026-01-03', occupiedRooms: 12 })
  })

  it('uses the authenticated company for reads', async () => {
    await (getDaily as any)({})
    expect(mocks.store.list).toHaveBeenCalledWith(9)

    mocks.query = { date: '2026-01-03' }
    await (getDaily as any)({})
    expect(mocks.store.get).toHaveBeenCalledWith('2026-01-03', 9)
  })

  it('uses the authenticated company for saves', async () => {
    const result = await (putDaily as any)({})
    expect(result.code).toBe(200)
    expect(mocks.store.save).toHaveBeenCalledWith(mocks.body, 9, 'hotel', 1)
  })
})
