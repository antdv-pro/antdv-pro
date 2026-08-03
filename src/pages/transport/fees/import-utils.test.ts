import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseRegulatoryFeeWorkbook } from './import-utils'

describe('parseRegulatoryFeeWorkbook', () => {
  it('parses valid rows and reports invalid rows', () => {
    const sheet = XLSX.utils.json_to_sheet([
      { 规费类型: '交强险', 车号: '青A.12345', 单项总费用: 1200, 有效期开始日期: '2026-01-01', 有效期截止日期: '2026-12-31' },
      { 规费类型: '未知类型', 车号: '', 单项总费用: -1, 有效期开始日期: 'bad', 有效期截止日期: '2026-01-01' },
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, '规费记录导入')

    const result = parseRegulatoryFeeWorkbook(workbook, ['交强险'])
    expect(result.records).toEqual([expect.objectContaining({ rowNumber: 2, feeType: '交强险', plateNo: '青A·12345', totalAmount: 1200 })])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('第 3 行')
  })

  it('rejects duplicate records in the same workbook', () => {
    const duplicate = { 规费类型: '交强险', 车号: '青A.12345', 挂号: '', 单项总费用: 1200, 有效期开始日期: '2026-01-01', 有效期截止日期: '2026-12-31' }
    const sheet = XLSX.utils.json_to_sheet([duplicate, { ...duplicate, 车号: '青A·12345', 单项总费用: 1300 }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, '规费记录导入')

    const result = parseRegulatoryFeeWorkbook(workbook, ['交强险'])
    expect(result.records).toHaveLength(1)
    expect(result.errors).toEqual(['第 3 行：与第 2 行重复，禁止导入'])
  })
})
