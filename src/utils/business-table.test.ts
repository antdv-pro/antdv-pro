import { describe, expect, it } from 'vitest'
import { businessColumnKey, businessTableCellClass, compareBusinessTableValue, createBusinessTableScrollX, displayBusinessTableValue, enhanceBusinessTableColumns, getBusinessTableValue } from './business-table'

describe('business table utilities', () => {
  it('reads nested values and normalizes display values', () => {
    expect(businessColumnKey(['company', 'name'])).toBe('name')
    expect(getBusinessTableValue({ company: { name: '甲公司' } }, ['company', 'name'])).toBe('甲公司')
    expect(displayBusinessTableValue(null)).toBe('-')
    expect(displayBusinessTableValue(0)).toBe('0')
  })

  it('sorts formatted numbers, dates and localized text', () => {
    expect(compareBusinessTableValue('¥1,200', '900')).toBeGreaterThan(0)
    expect(compareBusinessTableValue('2026-01-02', '2026-01-01')).toBeGreaterThan(0)
    expect(compareBusinessTableValue('乙', '甲')).toBeGreaterThan(0)
  })

  it('enhances columns according to business semantics', () => {
    const columns = enhanceBusinessTableColumns([
      { title: '金额', dataIndex: 'amount' },
      { title: '创建时间', dataIndex: 'createdAt' },
      { title: '状态', dataIndex: 'status' },
      { title: '操作', dataIndex: 'action', customCell: () => ({ class: 'existing' }) },
    ])
    expect(columns.map(({ width, align, ellipsis }) => ({ width, align, ellipsis }))).toEqual([
      { width: 128, align: 'right', ellipsis: false },
      { width: 170, align: 'center', ellipsis: false },
      { width: 110, align: 'center', ellipsis: false },
      { width: 180, align: 'center', ellipsis: false },
    ])
    expect(columns[0].sorter({ amount: 2 }, { amount: 1 })).toBe(1)
    expect(columns[3].sorter).toBeUndefined()
    expect(columns[2].customCell()).toEqual({ class: 'table-cell-status' })
    expect(columns[3].customCell()).toEqual({ class: 'existing table-cell-action' })
  })

  it('honors overrides and calculates nested scroll widths', () => {
    const [column] = enhanceBusinessTableColumns([{ title: '自定义', dataIndex: 'score', width: 75, align: 'left', ellipsis: true, sorter: true }], { numberFields: ['score'] })
    expect(column).toMatchObject({ width: 75, align: 'left', ellipsis: false, sorter: true })
    expect(businessTableCellClass('score', { numberFields: ['score'] })).toBe('table-cell-number')
    expect(createBusinessTableScrollX([{ width: 100 }, { children: [{ width: 120 }, { width: '80px' }] }], 200, 20)).toBe(320)
  })
})
