import dayjs from 'dayjs'
import { defineEventHandler, readBody } from 'h3'
import { calculateTransportFreightExcludingTax } from '../../../../shared/transport-freight'

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

function normalizeMonthKey(value?: string) {
  if (!value)
    return ''

  const matched = value.match(/(\d{4})[-/年.]?(\d{1,2})/)
  if (!matched)
    return ''

  return `${matched[1]}${matched[2].padStart(2, '0')}`
}

function getRowBusinessDate(row: Record<string, any>) {
  const dateValue = row.shipDate || row.date || row.repairDate
  if (dateValue)
    return dayjs(dateValue)

  const monthKey = normalizeMonthKey(row.financeMonth || row.month)
  if (monthKey)
    return dayjs(`${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}-01`)

  if (row.updatedAt)
    return dayjs(row.updatedAt)

  return undefined
}

function matches(row: Record<string, any>, filters: Record<string, any>) {
  const keyword = String(filters.keyword ?? '').trim()
  const status = String(filters.status ?? '').trim()
  if (keyword && !Object.values(row).some(value => String(value ?? '').includes(keyword)))
    return false
  if (status) {
    const statusMap: Record<string, string[]> = {
      pending: ['待审核', '待处理', '待派车', '待审批', '待完善', '待确认', '待复核', '待还款'],
      running: ['运输中', '处理中', '审批中', '生效中', '核算中', '推修中'],
      done: ['已完成', '已通过', '已发放', '已扣款', '正常'],
    }
    const allowed = statusMap[status] ?? [status]
    if (!allowed.some(item => String(row.status ?? '').includes(item)))
      return false
  }
  if (filters.startDate && filters.endDate) {
    const rowDate = getRowBusinessDate(row)
    if (rowDate?.isValid() && (rowDate.isBefore(dayjs(filters.startDate), 'day') || !rowDate.isBefore(dayjs(filters.endDate), 'day')))
      return false
  }
  return true
}

function comparison(current: number, previous: number, previousValue: string | number = previous) {
  if (!previous) {
    return current
      ? { previousValue, direction: 'new' as const }
      : { previousValue, direction: 'flat' as const, percent: 0 }
  }

  const change = (current - previous) / Math.abs(previous) * 100
  if (Math.abs(change) < 0.05)
    return { previousValue, direction: 'flat' as const, percent: 0 }

  return {
    previousValue,
    direction: change > 0 ? 'up' as const : 'down' as const,
    percent: Math.abs(change),
  }
}

function orderMetrics(rows: Array<Record<string, any>>) {
  return {
    count: rows.length,
    freightTotal: rows.reduce((sum, row) => sum + toNumber(row.freightTotal), 0),
    taxedFreight: rows.reduce((sum, row) => {
      const savedAmount = toNumber(row.taxedFreight)
      return sum + (savedAmount || calculateTransportFreightExcludingTax(toNumber(row.freightTotal)))
    }, 0),
    pending: rows.filter(row => String(row.status ?? '').includes('待')).length,
  }
}

function previousFinancialMonthFilters(filters: Record<string, any>) {
  if (!filters.financialYear || !filters.financialMonth || filters.periodType !== 'financialMonth')
    return undefined

  const currentMonth = dayjs(`${filters.financialYear}-${String(filters.financialMonth).padStart(2, '0')}-01`)
  const previousMonth = currentMonth.subtract(1, 'month')
  const startDate = previousMonth.subtract(1, 'month').date(26).format('YYYY-MM-DD')
  const endDate = previousMonth.date(26).format('YYYY-MM-DD')
  return { ...filters, startDate, endDate }
}

function summarize(moduleName: string, rows: Array<Record<string, any>>, previousRows: Array<Record<string, any>> = []) {
  if (moduleName === 'TransportOrders') {
    const current = orderMetrics(rows)
    const previous = orderMetrics(previousRows)
    return [
      { label: '总订单数', value: current.count, comparison: comparison(current.count, previous.count, `${previous.count} 单`), tone: 'primary' },
      { label: '运费总额', value: money(current.freightTotal), comparison: comparison(current.freightTotal, previous.freightTotal, money(previous.freightTotal)), tone: 'success' },
      { label: '税后运费总额', value: money(current.taxedFreight), comparison: comparison(current.taxedFreight, previous.taxedFreight, money(previous.taxedFreight)), tone: 'success' },
      { label: '待审核订单数', value: current.pending, comparison: comparison(current.pending, previous.pending, `${previous.pending} 单`), tag: current.pending ? '需及时处理' : '状态正常', tone: current.pending ? 'warning' : 'success' },
    ]
  }

  if (moduleName === 'TransportFuel') {
    const amount = rows.reduce((sum, row) => sum + toNumber(row.amount), 0)
    const vehicles = new Set(rows.map(row => row.plateNo || row.name).filter(Boolean)).size
    const previousAmount = previousRows.reduce((sum, row) => sum + toNumber(row.amount), 0)
    const previousVehicles = new Set(previousRows.map(row => row.plateNo || row.name).filter(Boolean)).size
    return [
      { label: '加油记录数', value: rows.length, comparison: comparison(rows.length, previousRows.length, `${previousRows.length} 笔`), tone: 'primary' },
      { label: '燃油支出', value: money(amount), comparison: comparison(amount, previousAmount, money(previousAmount)), tone: 'danger' },
      { label: '涉及车辆', value: vehicles, comparison: comparison(vehicles, previousVehicles, `${previousVehicles} 辆`), tone: 'default' },
      { label: '平均单笔', value: money(rows.length ? amount / rows.length : 0), comparison: comparison(rows.length ? amount / rows.length : 0, previousRows.length ? previousAmount / previousRows.length : 0, money(previousRows.length ? previousAmount / previousRows.length : 0)), tone: 'success' },
    ]
  }

  if (moduleName === 'TransportDriverPayroll') {
    const payrollMetrics = (source: Array<Record<string, any>>) => ({
      attendanceDays: source
        .filter(row => String(row.crewRole || '司机').includes('司机'))
        .reduce((sum, row) => sum + toNumber(row.attendanceDays), 0),
      tripCount: source.reduce((sum, row) => sum + toNumber(row.tripCount), 0),
      pendingCount: source.filter(row => /待|核算|审批/.test(String(row.status || row.approvalStatus || '')) && !/通过|已发放/.test(String(row.status || row.approvalStatus || ''))).length,
      netSalary: source.reduce((sum, row) => sum + toNumber(row.netSalary || row.amount), 0),
    })
    const current = payrollMetrics(rows)
    const previous = payrollMetrics(previousRows)
    return [
      { label: '出勤天数', value: `${current.attendanceDays} 天`, comparison: comparison(current.attendanceDays, previous.attendanceDays, `${previous.attendanceDays} 天`), tone: 'primary' },
      { label: '运输趟次', value: `${current.tripCount} 趟`, comparison: comparison(current.tripCount, previous.tripCount, `${previous.tripCount} 趟`), tone: 'default' },
      { label: '待核算/审批', value: `${current.pendingCount} 单`, comparison: comparison(current.pendingCount, previous.pendingCount, `${previous.pendingCount} 单`), tone: current.pendingCount ? 'warning' : 'success' },
      { label: '实发合计', value: money(current.netSalary), comparison: comparison(current.netSalary, previous.netSalary, money(previous.netSalary)), tone: 'success' },
    ]
  }

  const abnormal = rows.filter(row => /待|异常|预警|截止|离线/.test(String(row.status ?? ''))).length
  const previousAbnormal = previousRows.filter(row => /待|异常|预警|截止|离线/.test(String(row.status ?? ''))).length
  const amount = rows.reduce((sum, row) => sum + toNumber(row.amount || row.freightTotal), 0)
  const previousAmount = previousRows.reduce((sum, row) => sum + toNumber(row.amount || row.freightTotal), 0)
  const currentTypes = new Set(rows.map(row => row.type || row.category || row.source).filter(Boolean)).size
  const previousTypes = new Set(previousRows.map(row => row.type || row.category || row.source).filter(Boolean)).size
  return [
    { label: '记录总数', value: rows.length, comparison: comparison(rows.length, previousRows.length, `${previousRows.length} 条`), tone: 'primary' },
    { label: '异常/待处理', value: abnormal, comparison: comparison(abnormal, previousAbnormal, `${previousAbnormal} 条`), tag: abnormal ? '需及时处理' : '状态正常', tone: abnormal ? 'warning' : 'success' },
    { label: '金额合计', value: money(amount), comparison: comparison(amount, previousAmount, money(previousAmount)), tone: 'success' },
    { label: '业务类型数', value: currentTypes, comparison: comparison(currentTypes, previousTypes, `${previousTypes} 类`), tone: 'default' },
  ]
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const sourceRows = body.rows ?? []
  const filters = body.filters ?? {}
  const rows = sourceRows.filter((row: Record<string, any>) => matches(row, filters))
  const previousFilters = previousFinancialMonthFilters(filters)
  const previousRows = previousFilters
    ? sourceRows.filter((row: Record<string, any>) => matches(row, previousFilters))
    : []
  const cards = summarize(String(body.moduleName ?? ''), rows, previousRows)
  return {
    code: 200,
    msg: '获取成功',
    data: rows.length ? cards : cards.map(card => ({ ...card, dataState: 'empty' as const })),
  }
})
