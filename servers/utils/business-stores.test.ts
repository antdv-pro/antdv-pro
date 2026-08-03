import { beforeEach, describe, expect, it, vi } from 'vitest'

import { billReconciliationStore } from './bill-reconciliation-store'
import { hotelDailyStore } from './hotel-daily-store'
import { hotelRevenueStore } from './hotel-revenue-store'
import { buildTradeOrderAnalytics, tradeOrderStore } from './trade-order-store'

const mocks = vi.hoisted(() => ({
  pool: undefined as any,
  required: false,
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}))
vi.mock('./mysql', () => ({
  getMysqlPool: () => mocks.pool,
  isDatabaseRequired: () => mocks.required,
  withMysqlTransaction: (_db: any, handler: any) => handler(mocks.pool),
}))
vi.mock('./json-store', () => ({ readJsonFile: mocks.readJsonFile, writeJsonFile: mocks.writeJsonFile }))

describe('small business stores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pool = undefined
    mocks.required = false
  })

  it('normalizes and filters local hotel revenue records by date', async () => {
    mocks.readJsonFile.mockReturnValue([{ id: '1', date: '2026-01-01', roomOrOrderNo: '301', roomType: '标准间', channel: '携程' }, { id: '2', date: '2026-01-02' }, { id: '', date: '2026-01-01' }, null])
    await expect(hotelRevenueStore.list('2026-01-01')).resolves.toEqual([{ id: '1', date: '2026-01-01' }])
  })

  it('replaces one local hotel date while preserving other dates', async () => {
    mocks.readJsonFile.mockReturnValue([{ id: 'old', date: '2026-01-01' }, { id: 'keep', date: '2026-01-02' }])
    await expect(hotelRevenueStore.replaceByDate('2026-01-01', [{ id: 'new', date: 'wrong' }, { id: '' }])).resolves.toEqual([{ id: 'new', date: '2026-01-01' }])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('hotel-revenue-records.json'), [
      { id: 'new', date: '2026-01-01' },
      { id: 'keep', date: '2026-01-02' },
    ])
  })

  it('normalizes and saves fixed-capacity hotel daily occupancy', async () => {
    mocks.readJsonFile.mockReturnValue([{ date: '2026-01-02', totalRooms: 88, occupiedRooms: 120, remark: '  夜审  ' }])
    await expect(hotelDailyStore.list()).resolves.toEqual([expect.objectContaining({
      date: '2026-01-02',
      totalRooms: 100,
      occupiedRooms: 100,
      remark: '夜审',
    })])

    mocks.readJsonFile.mockReturnValue([])
    await expect(hotelDailyStore.save({ date: '2026-01-03', occupiedRooms: 63, remark: '正常营业' })).resolves.toEqual(expect.objectContaining({
      date: '2026-01-03',
      totalRooms: 100,
      occupiedRooms: 63,
    }))
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('hotel-daily-records.json'), [expect.objectContaining({ date: '2026-01-03' })])
  })

  it('normalizes local trade orders and replaces the stored set', async () => {
    mocks.readJsonFile.mockReturnValue([{ code: 'A' }, {}, null])
    await expect(tradeOrderStore.list()).resolves.toEqual([{ code: 'A' }])
    await expect(tradeOrderStore.replace([{ code: 'B' }, { code: '' }])).resolves.toEqual([{ code: 'B' }])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('trade-orders.json'), [{ code: 'B' }])
  })

  it('applies local hotel and trade changes without replacing unrelated rows', async () => {
    mocks.readJsonFile
      .mockReturnValueOnce([{ id: 'keep', date: '2026-01-01' }, { id: 'drop', date: '2026-01-01' }, { id: 'other', date: '2026-01-02' }])
      .mockReturnValueOnce([{ id: 'keep', date: '2026-01-01' }, { id: 'new', date: '2026-01-01' }, { id: 'other', date: '2026-01-02' }])
      .mockReturnValueOnce([{ code: 'keep' }, { code: 'drop' }])
    await expect(hotelRevenueStore.applyChanges('2026-01-01', { upsert: [{ id: 'new', date: 'wrong' }], deleteIds: ['drop'] })).resolves.toEqual([
      { id: 'keep', date: '2026-01-01' },
      { id: 'new', date: '2026-01-01' },
    ])
    await expect(tradeOrderStore.applyChanges({ upsert: [{ code: 'new' }], deleteCodes: ['drop'] })).resolves.toEqual([{ code: 'keep' }, { code: 'new' }])
  })

  it('enforces trade order transitions and locks settled orders in the store', async () => {
    mocks.readJsonFile.mockReturnValue([{ code: 'A', status: '待确认' }])
    await expect(tradeOrderStore.applyChanges({ upsert: [{ code: 'A', status: '已结算' }] })).rejects.toThrow('只能从“待确认”流转到“已确认”')

    mocks.readJsonFile.mockReturnValue([{ code: 'B', status: '已结算' }])
    await expect(tradeOrderStore.applyChanges({ deleteCodes: ['B'] })).rejects.toThrow('已结算订单已锁定')
    await expect(tradeOrderStore.applyChanges({ upsert: [{ code: 'B', status: '已结算', carrier: '更正' }] })).rejects.toThrow('已结算订单已锁定')

    mocks.readJsonFile.mockReturnValue([{ code: 'C', status: '已结算' }])
    await expect(tradeOrderStore.replace([])).rejects.toThrow('已结算订单已锁定')

    mocks.readJsonFile.mockReturnValue([{ code: 'C', status: '已结算' }])
    await expect(tradeOrderStore.replace([{ code: 'C', status: '已结算' }])).resolves.toEqual([{ code: 'C', status: '已结算' }])
  })

  it('filters, summarizes and paginates local trade orders by financial period', async () => {
    mocks.readJsonFile.mockReturnValue([
      { code: 'A', loadingDate: '2026-06-26', carrier: '诚捷', plateNo: '青A001', status: '待确认', loadingTon: 10, unloadingTon: 9, payableTotal: 100, receivableLiquidTotal: 150, profit: 30 },
      { code: 'B', loadingDate: '2026-07-25', carrier: '诚捷', plateNo: '青A001', status: '已结算', loadingTon: 20, unloadingTon: 19, payableTotal: 200, receivableLiquidTotal: 280, profit: 50 },
      { code: 'C', loadingDate: '2026-07-26', carrier: '外协', plateNo: '青A002', status: '待确认', loadingTon: 30, unloadingTon: 29, payableTotal: 300, receivableLiquidTotal: 390, profit: 60 },
    ])

    await expect(tradeOrderStore.listPage(1, 10, { year: 2026, month: 7, plateNo: '青A001', sortField: 'profit', sortOrder: 'ascend' })).resolves.toEqual(expect.objectContaining({
      records: [expect.objectContaining({ code: 'A' }), expect.objectContaining({ code: 'B' })],
      total: 2,
      summary: expect.objectContaining({ count: 2, loadingTon: 30, payableTotal: 300, profit: 80 }),
      facets: {
        years: ['2026'],
        statuses: ['已结算', '待确认'],
        plateNos: ['青A001', '青A002'],
      },
    }))

    await expect(tradeOrderStore.listFiltered({ keyword: '外协', sortField: 'loadingDate', sortOrder: 'descend' })).resolves.toEqual([
      expect.objectContaining({ code: 'C' }),
    ])
  })

  it('builds complete trade analytics by status, financial month and customer', () => {
    const result = buildTradeOrderAnalytics([
      { code: 'A', loadingDate: '2026-06-26', status: '待确认', receiver: '客户甲', receivableLiquidTotal: 150, payableTotal: 80, freightTotal: 20, cargoLoss: 5, profit: 45 },
      { code: 'B', loadingDate: '2026-07-25', status: '已结算', receiver: '客户甲', receivableLiquidTotal: 280, payableTotal: 180, freightTotal: 30, cargoLoss: 10, profit: 60 },
      { code: 'C', loadingDate: '2026-07-26', status: '待确认', receiver: '客户乙', receivableLiquidTotal: 390, payableTotal: 260, freightTotal: 40, cargoLoss: 10, profit: 80 },
    ])
    expect(result.statuses).toEqual([
      { status: '待确认', count: 2, receivable: 540, profit: 125 },
      { status: '已结算', count: 1, receivable: 280, profit: 60 },
    ])
    expect(result.months).toEqual([
      { month: '2026-07', receivable: 430, payable: 325, profit: 105 },
      { month: '2026-08', receivable: 390, payable: 310, profit: 80 },
    ])
    expect(result.customers[0]).toEqual({ name: '客户甲', count: 2, receivable: 430, profit: 105 })
  })

  it('upserts a local reconciliation archive at the front', async () => {
    mocks.readJsonFile.mockReturnValue([{ id: 'A', value: 1 }, { id: 'B' }])
    await expect(billReconciliationStore.save({ id: 'A', value: 2 })).resolves.toEqual([{ id: 'A', value: 2 }, { id: 'B' }])
    expect(mocks.writeJsonFile).toHaveBeenCalledWith(expect.stringContaining('bill-reconciliation-archives.json'), [{ id: 'A', value: 2 }, { id: 'B' }])
  })

  it('rejects every local fallback when the database is mandatory', async () => {
    mocks.required = true
    await expect(hotelRevenueStore.list()).rejects.toThrow('酒店营收禁止读取本地 JSON')
    await expect(hotelRevenueStore.replaceByDate('2026-01-01', [])).rejects.toThrow('酒店营收禁止写入本地 JSON')
    await expect(hotelDailyStore.list()).rejects.toThrow('酒店房态禁止读取本地 JSON')
    await expect(hotelDailyStore.save({ date: '2026-01-01', occupiedRooms: 1 })).rejects.toThrow('酒店房态禁止写入本地 JSON')
    await expect(tradeOrderStore.list()).rejects.toThrow('贸易订单禁止读取本地 JSON')
    await expect(tradeOrderStore.replace([])).rejects.toThrow('贸易订单禁止写入本地 JSON')
    await expect(billReconciliationStore.list()).rejects.toThrow('对账归档禁止读取本地 JSON')
    await expect(billReconciliationStore.save({ id: 'A' })).rejects.toThrow('对账归档禁止写入本地 JSON')
  })

  it('reads JSON payloads from MySQL and binds hotel date filters', async () => {
    const query = vi.fn(async (sql: string) => String(sql).includes('SELECT revenue_json')
      ? [[{ revenue_json: '{"id":"1","date":"2026-01-01"}' }, { revenue_json: { id: '2', date: '2026-01-01' } }]]
      : [[]])
    mocks.pool = { query, execute: vi.fn() }
    await expect(hotelRevenueStore.list('2026-01-01')).resolves.toHaveLength(2)
    const listCall = query.mock.calls.find(([sql]) => String(sql).includes('SELECT revenue_json'))
    expect(listCall?.[1]).toEqual(['2026-01-01'])
  })

  it('soft-deletes and upserts normalized trade rows in MySQL', async () => {
    const execute = vi.fn().mockResolvedValue([{}])
    mocks.pool = { query: vi.fn().mockResolvedValue([[]]), execute }
    const row = { code: 'A', status: '待确认', loadingDate: '2026-07-19', payableTotal: 10 }
    await expect(tradeOrderStore.replace([row, {}])).resolves.toEqual([row])
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0][0]).toContain('UPDATE trade_order SET deleted_at')
    expect(execute.mock.calls[1][0]).toContain('status = VALUES(status)')
    expect(execute.mock.calls[1][0]).toContain('loading_date = VALUES(loading_date)')
    expect(execute.mock.calls[1][0]).toContain('amount = VALUES(amount)')
    expect(execute.mock.calls[1][1]).toEqual(['A', JSON.stringify(row), '待确认', '2026-07-19', 10])
  })

  it('binds filtered trade pagination and returns summary facets in MySQL', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('COUNT(*) AS total'))
        return [[{ total: 1 }]]
      if (sql.includes('SELECT order_json') && sql.includes('LIMIT'))
        return [[{ order_json: { code: 'A', plateNo: '青A001' } }]]
      if (sql.includes('COALESCE(SUM'))
        return [[{ count: 1, loadingTon: 10, unloadingTon: 9, payableTotal: 100, receivableTotal: 150, profit: 30 }]]
      if (sql.includes('SELECT DISTINCT status'))
        return [[{ status: '待确认', plateNo: '青A001', financialYear: 2026 }]]
      return [[]]
    })
    mocks.pool = { query, execute: vi.fn() }

    await expect(tradeOrderStore.listPage(2, 20, { keyword: '诚捷', year: 2026, month: 7, status: '待确认', plateNo: '青A001' })).resolves.toEqual(expect.objectContaining({
      records: [{ code: 'A', plateNo: '青A001' }],
      total: 1,
      current: 2,
      pageSize: 20,
      summary: expect.objectContaining({ count: 1, profit: 30 }),
      facets: { years: ['2026'], statuses: ['待确认'], plateNos: ['青A001'] },
    }))

    const pageCall = query.mock.calls.find(([sql]) => String(sql).includes('SELECT order_json') && String(sql).includes('LIMIT'))
    expect(pageCall?.[0]).toContain('DATE_ADD(COALESCE(loading_date, STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(order_json, \'$.loadingDate\'))')
    expect(pageCall?.[1]).toEqual(['%诚捷%', '%诚捷%', '%诚捷%', '%诚捷%', '%诚捷%', '%诚捷%', '%诚捷%', 2026, 7, '待确认', '青A001', 20, 20])
  })

  it('upserts a reconciliation archive in MySQL and returns the refreshed list', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ archive_json: '{"id":"A","done":true}' }]])
    const execute = vi.fn().mockResolvedValue([{}])
    mocks.pool = { query, execute }
    await expect(billReconciliationStore.save({ id: 'A', done: true })).resolves.toEqual([{ id: 'A', done: true }])
    expect(execute.mock.calls[0][1]).toEqual(['A', JSON.stringify({ id: 'A', done: true })])
  })
})
