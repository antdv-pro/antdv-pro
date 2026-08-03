import { describe, expect, it } from 'vitest'
import { computeBusinessOverview, financialPeriodKeyFromDate } from './business-overview'

describe('shared business overview', () => {
  it('uses the 26th-to-25th financial month boundary', () => {
    expect(financialPeriodKeyFromDate('2026-06-25')).toBe('202606')
    expect(financialPeriodKeyFromDate('2026-06-26')).toBe('202607')
    expect(financialPeriodKeyFromDate('2026-12-26')).toBe('202701')
  })

  it('shares transport, trade, and hotel formulas for a financial month', () => {
    const result = computeBusinessOverview({
      periodKey: '202607',
      transportOrders: [
        { financeMonth: '2026-07', shipDate: '2026-05-01', plateNo: '青A1', freightTotal: '¥100,000.50', taxedFreight: 91743.58 },
        { shipDate: '2026-06-26', plateNo: '青A2', freightTotal: 200000, taxedFreight: 183486.24 },
        { shipDate: '2026-06-25', plateNo: '青A3', freightTotal: 999999, taxedFreight: 999999 },
      ],
      tradeOrders: [
        { loadingDate: '2026-07-01', receivableLiquidTotal: 500000, payableTotal: 300000, freightTotal: 50000, cargoLoss: 10000, status: '待确认' },
        { loadingDate: '2026-07-26', receivableLiquidTotal: 1, payableTotal: 0, freightTotal: 0, cargoLoss: 0, status: '已结算' },
      ],
      hotelRevenue: [
        { date: '2026-07-01', type: '收入', amount: 10000 },
        { date: '2026-07-02', type: '支出', amount: 2500 },
        { date: '2026-07-26', type: '收入', amount: 99999 },
      ],
      hotelDaily: [
        { date: '2026-07-01', totalRooms: 100, occupiedRooms: 40 },
        { date: '2026-07-20', totalRooms: 80, occupiedRooms: 60 },
      ],
    })

    expect(result.transport).toEqual({ orderCount: 2, vehicleCount: 2, freight: 300000.5, taxedFreight: 275229.82 })
    expect(result.trade).toMatchObject({ orderCount: 1, unsettledCount: 1, receivable: 500000, payable: 300000, profit: 140000 })
    expect(result.hotel).toEqual({ income: 10000, expense: 2500, netIncome: 7500, latestDailyDate: '2026-07-20', occupancyRate: 75, hasDaily: true })
  })
})
