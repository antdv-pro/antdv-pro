export interface BusinessOverviewInput {
  periodKey: string
  transportOrders: Array<Record<string, any>>
  tradeOrders: Array<Record<string, any>>
  hotelRevenue: Array<Record<string, any>>
  hotelDaily: Array<Record<string, any>>
}

function number(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function explicitPeriodKey(value: unknown) {
  const normalized = String(value ?? '').replace(/\D/g, '')
  return /^\d{6}$/.test(normalized) ? normalized : ''
}

export function financialPeriodKeyFromDate(value: unknown) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match)
    return ''
  let year = Number(match[1])
  let month = Number(match[2])
  if (Number(match[3]) >= 26) {
    month += 1
    if (month === 13) {
      year += 1
      month = 1
    }
  }
  return `${year}${String(month).padStart(2, '0')}`
}

export function computeBusinessOverview(input: BusinessOverviewInput) {
  const transportOrders = input.transportOrders.filter((order) => {
    const key = explicitPeriodKey(order.financeMonth) || financialPeriodKeyFromDate(order.shipDate)
    return key === input.periodKey
  })
  const tradeOrders = input.tradeOrders.filter(order => financialPeriodKeyFromDate(order.loadingDate) === input.periodKey)
  const hotelRevenue = input.hotelRevenue.filter(record => financialPeriodKeyFromDate(record.date) === input.periodKey)
  const hotelDaily = input.hotelDaily
    .filter(record => financialPeriodKeyFromDate(record.date) === input.periodKey)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const latestHotelDaily = hotelDaily[0]

  const transportFreight = transportOrders.reduce((total, order) => total + number(order.freightTotal), 0)
  const transportTaxedFreight = transportOrders.reduce((total, order) => total + number(order.taxedFreight), 0)
  const tradeReceivable = tradeOrders.reduce((total, order) => total + number(order.receivableLiquidTotal), 0)
  const tradePayable = tradeOrders.reduce((total, order) => total + number(order.payableTotal), 0)
  const tradeFreight = tradeOrders.reduce((total, order) => total + number(order.freightTotal), 0)
  const tradeCargoLoss = tradeOrders.reduce((total, order) => total + number(order.cargoLoss), 0)
  const hotelIncome = hotelRevenue.filter(record => record.type === '收入').reduce((total, record) => total + number(record.amount), 0)
  const hotelExpense = hotelRevenue.filter(record => record.type === '支出').reduce((total, record) => total + number(record.amount), 0)
  const totalRooms = number(latestHotelDaily?.totalRooms)

  return {
    transport: {
      orderCount: transportOrders.length,
      vehicleCount: new Set(transportOrders.map(order => String(order.plateNo || '').trim()).filter(Boolean)).size,
      freight: transportFreight,
      taxedFreight: transportTaxedFreight,
    },
    trade: {
      orderCount: tradeOrders.length,
      unsettledCount: tradeOrders.filter(order => !['已结算', '已完成'].includes(String(order.status || ''))).length,
      receivable: tradeReceivable,
      payable: tradePayable,
      freight: tradeFreight,
      cargoLoss: tradeCargoLoss,
      profit: tradeReceivable - tradePayable - tradeFreight - tradeCargoLoss,
    },
    hotel: {
      income: hotelIncome,
      expense: hotelExpense,
      netIncome: hotelIncome - hotelExpense,
      latestDailyDate: latestHotelDaily?.date ? String(latestHotelDaily.date) : '',
      occupancyRate: totalRooms ? Math.round(number(latestHotelDaily.occupiedRooms) / totalRooms * 100) : 0,
      hasDaily: Boolean(latestHotelDaily),
    },
  }
}
