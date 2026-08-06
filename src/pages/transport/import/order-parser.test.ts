import { describe, expect, it } from 'vitest'
import { normalizeOrderRows, readOrderRowsFromMatrix } from './order-parser'

describe('transport order import parser', () => {
  it('reads a two-row order header and normalizes aliases', () => {
    const matrix = [
      ['运输订单'],
      ['订单编号', '车辆', '路线', '运费总价', '出车日期', '司机'],
      ['', '', '', '', '', ''],
      ['YS001', '青 A12345', '西宁-格尔木', '1200.5', '2026-07-16', '张三'],
    ]
    const rows = normalizeOrderRows(readOrderRowsFromMatrix(matrix))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      code: 'YS001',
      plateNo: '青A12345',
      routeLine: '西宁-格尔木',
      freightTotal: '¥1,200.50',
      shipDate: '2026-07-16',
      driver: '张三',
    })
  })

  it('rejects rows without a plate, route, or positive freight', () => {
    expect(normalizeOrderRows([{ 订单编号: 'YS002', 车辆: '', 路线: '', 运费总价: 0 }])).toEqual([])
  })
})
