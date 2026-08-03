import dayjs from 'dayjs'
import { defineEventHandler, readBody } from 'h3'

function matches(record: Record<string, any>, filters: Record<string, any>) {
  if (filters.project && !String(record.project ?? '').includes(String(filters.project)))
    return false
  if (filters.financialMonth && record.financialMonth !== filters.financialMonth)
    return false
  if (filters.plateNo && !String(record.plateNo ?? '').includes(String(filters.plateNo)))
    return false
  if (filters.remark && !String(record.remark ?? '').includes(String(filters.remark)))
    return false
  if (filters.shop && record.shop !== filters.shop)
    return false
  if (filters.startDate && filters.endDate) {
    const current = dayjs(record.repairDate)
    if (current.isBefore(dayjs(filters.startDate), 'day') || current.isAfter(dayjs(filters.endDate), 'day'))
      return false
  }
  return true
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const filters = body.filters ?? {}
  const rows = (body.records ?? []).filter((record: Record<string, any>) => matches(record, filters))
  const totalAmount = rows.reduce((sum: number, item: Record<string, any>) => sum + Number(item.amount || 0), 0)

  return {
    code: 200,
    msg: '获取成功',
    data: {
      totalCount: rows.length,
      totalAmount,
      pendingCount: rows.filter((item: Record<string, any>) => item.status === '待审核').length,
      repairingCount: rows.filter((item: Record<string, any>) => item.status === '推修中').length,
      approvedCount: rows.filter((item: Record<string, any>) => item.status === '已审核').length,
      averageAmount: rows.length ? totalAmount / rows.length : 0,
    },
  }
})
