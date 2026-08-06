import { describe, expect, it } from 'vitest'
import { normalizeTransportFuelRecord } from './transport-fuel-store'

describe('transport fuel record normalization', () => {
  it('normalizes a manually entered fuel record', () => {
    expect(normalizeTransportFuelRecord({
      code: 'FUEL-TEST-1',
      date: '2026-07-24 09:30',
      plateNo: '青H12345',
      location: '西宁测试加油站',
      product: 'LNG',
      quantity: 120.5,
      amount: 800,
      driver: '测试司机',
    }, { manual: true })).toMatchObject({
      code: 'FUEL-TEST-1',
      month: '202607',
      date: '2026-07-24 09:30',
      plateNo: '青H12345',
      quantity: '120.5L',
      quantityUnit: 'L',
      amount: '¥800.00',
      status: '已录入',
      source: 'manual',
    })
  })

  it('rejects incomplete or zero-value fuel records', () => {
    expect(() => normalizeTransportFuelRecord({ date: '2026-07-24', plateNo: '', location: '油站', quantity: 1, amount: 1 })).toThrow('车牌号不能为空')
    expect(() => normalizeTransportFuelRecord({ date: '2026-07-24', plateNo: '青H12345', location: '油站', product: 'LNG', quantity: 0, amount: 1 }, { manual: true })).toThrow('加油量必须大于0')
  })

  it('preserves kilogram quantities from LNG provider files', () => {
    expect(normalizeTransportFuelRecord({
      code: 'TTH-20260602-青H53946-001',
      date: '2026-06-02 00:00',
      plateNo: '青H53946',
      location: '沱沱河',
      product: 'LNG',
      quantity: '245.06kg',
      amount: 1776.69,
    })).toMatchObject({ quantity: '245.06kg', quantityUnit: 'kg' })
  })
})
