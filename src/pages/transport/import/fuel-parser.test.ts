import { describe, expect, it } from 'vitest'
import { normalizeFuelRows, parseFuelDate } from './fuel-parser'

describe('fuel import parser', () => {
  it('normalizes provider column aliases', () => {
    expect(normalizeFuelRows([{
      交易流水号: 'F001',
      加油时间: '2026-07-16 09:30',
      车辆: '青A12345',
      加油地点: '西宁城东加油站',
      油品: '柴油',
      升数: '123.45',
      金额: '¥900.5',
      司机: '张三',
    }])[0]).toMatchObject({
      code: 'F001',
      month: '202607',
      plateNo: '青A12345',
      quantity: '123.45L',
      quantityUnit: 'L',
      amount: '¥900.50',
    })
  })

  it('supports Excel serial dates without importing XLSX on the UI thread', () => {
    expect(parseFuelDate(46_000)).toBeInstanceOf(Date)
  })

  it('maps Hongtong headers and uses the order number as the detail code', () => {
    expect(normalizeFuelRows([{
      '订单编号\n': 'S0202606010722240015801133085',
      '消费站点': '依吞布拉克清洁能源站',
      '企业车牌/企业IC卡': '青h53546',
      '加注类型': 'LNG',
      '加注数量': '174.38',
      '加注开始时间': '2026-06-01 07:17:42',
      '支付金额': '1109.06',
    }])[0]).toMatchObject({
      code: 'S0202606010722240015801133085',
      plateNo: '青H53546',
      location: '依吞布拉克清洁能源站',
      product: 'LNG',
      quantity: '174.38kg',
      quantityUnit: 'kg',
      amount: '¥1,109.06',
    })
  })

  it('fills down Tuotuohe dates and ignores rows without a vehicle', () => {
    const rows = normalizeFuelRows([
      { 公司名称: '青海诚捷', 日期: '2026.5.26', 公斤数量: '150.00', 金额: '1087.50', 卡内余额: '13494.96', 车号: '青HA4752' },
      { 公司名称: '', 日期: '', 公斤数量: '250.21', 金额: '1814.02', 卡内余额: '', 车号: '青H53948' },
      { 公司名称: '青海诚捷', 日期: '2026.5.27', 公斤数量: '0.00', 金额: '0.00', 卡内余额: '13494.96', 车号: '' },
    ])

    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      code: 'TTH-20260526-青H53948-002',
      date: '2026-05-26 00:00',
      plateNo: '青H53948',
      location: '沱沱河',
      product: 'LNG',
      quantity: '250.21kg',
      quantityUnit: 'kg',
      amount: '¥1,814.02',
    })
  })
})
