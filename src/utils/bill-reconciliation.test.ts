import { describe, expect, it } from 'vitest'
import { BILL_RECONCILIATION_CHECKS, isSameBillValue } from './bill-reconciliation'

describe('bill reconciliation checks', () => {
  it('only compares the seven approved business fields', () => {
    expect(BILL_RECONCILIATION_CHECKS.map(item => item.label)).toEqual([
      '客户',
      '路线',
      '吨位',
      '单价',
      '运距',
      '运费',
      '税后运费',
    ])
  })

  it('ignores sub-cent numeric noise but reports real differences', () => {
    expect(isSameBillValue(100, 100.009, 'number')).toBe(true)
    expect(isSameBillValue(100, 100.01, 'number')).toBe(false)
  })

  it('trims text before comparing', () => {
    expect(isSameBillValue('昆仑物流 ', '昆仑物流', 'text')).toBe(true)
    expect(isSameBillValue('路线 A', '路线 B', 'text')).toBe(false)
  })
})
